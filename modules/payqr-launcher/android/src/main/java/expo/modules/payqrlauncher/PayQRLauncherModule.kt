package expo.modules.payqrlauncher

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream

class PayQRLauncherModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PayQRLauncher")

    AsyncFunction("getApps") {
      val context = appContext.reactContext ?: error("App context unavailable")
      val manager = context.packageManager
      val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      @Suppress("DEPRECATION")
      val activities = manager.queryIntentActivities(intent, 0)
      activities
        .filter { it.activityInfo.packageName != context.packageName &&
          it.activityInfo.enabled && it.activityInfo.exported &&
          it.activityInfo.applicationInfo.enabled &&
          manager.getLaunchIntentForPackage(it.activityInfo.packageName) != null }
        .distinctBy { it.activityInfo.packageName }
        .map { info ->
          val icon = runCatching {
            val drawable = info.loadIcon(manager)
            val bitmap = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888)
            drawable.setBounds(0, 0, 64, 64)
            drawable.draw(Canvas(bitmap))
            val output = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
            bitmap.recycle()
            "data:image/png;base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)
          }.getOrNull()
          mapOf(
            "name" to info.loadLabel(manager).toString(),
            "packageName" to info.activityInfo.packageName,
            "icon" to icon
          )
        }
        .sortedBy { (it["name"] as String).lowercase() }
    }

    AsyncFunction("openApp") { packageName: String ->
      require(Regex("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+").matches(packageName)) {
        "Invalid application package"
      }
      val context = appContext.reactContext ?: error("App context unavailable")
      val launch = context.packageManager.getLaunchIntentForPackage(packageName)
        ?: error("App is no longer installed or cannot be opened. Choose another app.")
      context.startActivity(launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }
}
