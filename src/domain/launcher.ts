export const APP_TARGET_SCHEME = "payqr-app:";
export function packageTarget(packageName: string, name: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(packageName))
    throw new Error("Invalid application package");
  return `${APP_TARGET_SCHEME}//${packageName}?name=${encodeURIComponent(name)}`;
}
export function readPackageTarget(target: string) {
  if (!target.startsWith(APP_TARGET_SCHEME)) return null;
  const url = new URL(target);
  const packageName = url.hostname;
  if (
    url.username ||
    url.password ||
    url.port ||
    (url.pathname && url.pathname !== "/")
  )
    throw new Error("Invalid application target");
  packageTarget(packageName, "");
  return { packageName, name: url.searchParams.get("name") || packageName };
}

// Exact package IDs from the publishers' Google Play listings; labels are not trusted.
export const PAYMENT_PACKAGES = [
  "com.globe.gcash.android",
  "ph.com.gotyme",
  "ph.seabank.seabank",
  "com.paymaya",
  "com.paypal.android.p2pmobile",
];
export function groupApps<T extends { name: string; target: string }>(
  apps: T[],
  query = "",
) {
  const filtered = apps.filter((app) =>
    `${app.name} ${readPackageTarget(app.target)?.packageName || ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const rank = (app: T) =>
    PAYMENT_PACKAGES.indexOf(readPackageTarget(app.target)?.packageName || "");
  return [
    {
      title: "Payment apps",
      data: filtered
        .filter((app) => rank(app) >= 0)
        .sort((a, b) => rank(a) - rank(b)),
    },
    {
      title: "Other installed apps",
      data: filtered
        .filter((app) => rank(app) < 0)
        .sort((a, b) => a.name.localeCompare(b.name)),
    },
  ];
}
