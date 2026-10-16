package expo.modules.payqrocr

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PayQROCRModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PayQROCR")
    AsyncFunction("recognizeText") { uri: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("ERR_OCR", "App context unavailable", null)
      } else {
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        try {
          require(Uri.parse(uri).scheme == "file") { "Only local captures are supported" }
          val image = InputImage.fromFilePath(context, Uri.parse(uri))
          recognizer.process(image)
            .addOnSuccessListener { promise.resolve(it.text) }
            .addOnFailureListener { promise.reject("ERR_OCR", "Could not recognize text. Try a clearer photo.", it) }
            .addOnCompleteListener { recognizer.close() }
        } catch (e: Exception) {
          recognizer.close()
          promise.reject("ERR_OCR", "Could not read capture. Try again.", e)
        }
      }
    }
  }
}
