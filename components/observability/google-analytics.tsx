import Script from "next/script";
import { gaMeasurementId, isGaConfigured } from "@/lib/observability/public-config";

/** Loads gtag only when Measurement ID is set in public-config. */
export function GoogleAnalytics() {
  if (!isGaConfigured()) return null;

  const id = gaMeasurementId;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}');
        `}
      </Script>
    </>
  );
}
