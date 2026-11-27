
"use client";

import { usePathname } from "next/navigation";

/**
 * Premium Animated WhatsApp Floating Component
 *
 * Desktop: Support card + WhatsApp button.
 * Mobile: WhatsApp button only.
 *
 * Environment:
 * NEXT_PUBLIC_WHATSAPP_NUMBER=923001234567
 */

export default function WhatsappFloating() {
  const pathname = usePathname();

  const allowedRoutes = ["/login", "/signup"];
  const currentPath = pathname?.replace(/\/+$/, "") || "/";

  if (!allowedRoutes.includes(currentPath)) {
    return null;
  }

  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");

  if (!phone) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[WhatsappFloating] NEXT_PUBLIC_WHATSAPP_NUMBER is missing."
      );
    }

    return null;
  }

  const href = `https://wa.me/${phone}`;

  return (
    <>
      <div className="whatsapp-widget">

        {/* SUPPORT CARD */}

        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Contact customer support on WhatsApp"
          className="whatsapp-support"
        >
          <span className="support-content">
            <span className="support-title">
              Need Help?
            </span>

            <span className="support-subtitle">
              Chat with our support team
            </span>
          </span>

          {/* Shine animation */}
          <span className="support-shine" aria-hidden="true" />

          {/* Bottom-right pointed notch */}
          <span className="support-tail" aria-hidden="true" />
        </a>

        {/* WHATSAPP BUTTON */}

        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with us on WhatsApp"
          title="Chat with us on WhatsApp"
          className="whatsapp-button"
        >
          {/* Circular pulse rings */}
          <span
            className="whatsapp-pulse whatsapp-pulse-one"
            aria-hidden="true"
          />

          <span
            className="whatsapp-pulse whatsapp-pulse-two"
            aria-hidden="true"
          />

          <span
            className="whatsapp-pulse whatsapp-pulse-three"
            aria-hidden="true"
          />

          {/* Green button */}
          <span className="whatsapp-button-inner">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="whatsapp-icon"
              aria-hidden="true"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
            </svg>
          </span>

          {/* Online indicator */}
          <span className="whatsapp-online" aria-hidden="true" />
        </a>
      </div>

      {/* STYLING AND ANIMATIONS */}

      <style jsx>{`
        .whatsapp-widget {
          position: fixed;
          right: 20px;
          bottom: 20px;
          z-index: 100;

          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;

          pointer-events: none;
        }

        /* SUPPORT CARD */

        .whatsapp-support {
          position: relative;

          display: flex;
          align-items: center;

          width: 165px;
          min-height: 48px;

          padding: 8px 11px;

          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 13px;

          background: linear-gradient(
            135deg,
            #102f70 0%,
            #145ac7 55%,
            #2385ff 100%
          );

          color: #ffffff;
          text-decoration: none;

          box-shadow:
            0 8px 22px rgba(17, 77, 174, 0.28),
            0 3px 8px rgba(12, 45, 100, 0.15);

          pointer-events: auto;

          animation:
            support-entrance 0.8s ease-out both,
            support-float 3s ease-in-out 1s infinite;

          transition: box-shadow 0.3s ease;
        }

        .whatsapp-support:hover {
          box-shadow:
            0 12px 28px rgba(17, 77, 174, 0.4),
            0 4px 12px rgba(12, 45, 100, 0.2);
        }

        /* SUPPORT TEXT */

        .support-content {
          position: relative;
          z-index: 2;

          display: flex;
          flex-direction: column;
          gap: 3px;

          min-width: 0;
        }

        .support-title {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.2px;
          line-height: 1.2;
        }

        .support-subtitle {
          color: rgba(255, 255, 255, 0.88);
          font-size: 8px;
          font-weight: 500;
          line-height: 1.3;
          white-space: nowrap;
        }

        /* FIXED SHINE ANIMATION
           Shine is clipped inside the card.
           It can NEVER extend outside its boundaries.
        */

        .support-shine {
          position: absolute;
          inset: 0;

          border-radius: inherit;

          overflow: hidden;
          pointer-events: none;

          clip-path: inset(0 round 13px);
        }

        .support-shine::before {
          content: "";

          position: absolute;
          top: -30%;
          left: -45%;

          width: 22%;
          height: 160%;

          transform: rotate(25deg);

          border-radius: 30px;

          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.08),
            rgba(255, 255, 255, 0.32),
            rgba(255, 255, 255, 0.08),
            transparent
          );

          animation: support-shine 5s ease-in-out 2s infinite;
        }

        /* BOTTOM-RIGHT POINTED NOTCH */

        .support-tail {
          position: absolute;

          right: 20px;
          bottom: -7px;

          width: 14px;
          height: 14px;

          transform: rotate(45deg);

          border-radius: 2px;

          background: #2385ff;

          z-index: -1;
        }

        /* WHATSAPP BUTTON */

        .whatsapp-button {
          position: relative;

          display: grid;
          width: 58px;
          height: 58px;

          flex-shrink: 0;
          place-items: center;

          border-radius: 50%;

          background: #25d366;
          color: #ffffff;
          text-decoration: none;

          box-shadow:
            0 7px 20px rgba(37, 211, 102, 0.3),
            0 3px 8px rgba(0, 0, 0, 0.12);

          isolation: isolate;
          pointer-events: auto;

          transition:
            transform 0.3s ease,
            box-shadow 0.3s ease,
            background 0.3s ease;

          animation: button-entrance 0.7s ease-out both;
        }

        .whatsapp-button:hover {
          transform: scale(1.1);
          background: #20bd5a;

          box-shadow:
            0 10px 30px rgba(37, 211, 102, 0.45),
            0 0 0 5px rgba(37, 211, 102, 0.1);
        }

        .whatsapp-button:focus-visible {
          outline: 3px solid #1c72e8;
          outline-offset: 5px;
        }

        /* CIRCULAR PULSE */

        .whatsapp-pulse {
          position: absolute;
          inset: -2px;

          z-index: -1;

          border: 2px solid rgba(37, 211, 102, 0.8);
          border-radius: 50%;

          opacity: 0;
          pointer-events: none;

          animation: whatsapp-ripple 3s ease-out infinite;
        }

        .whatsapp-pulse-two {
          animation-delay: 1s;
        }

        .whatsapp-pulse-three {
          animation-delay: 2s;
        }

        /* GREEN BUTTON INNER */

        .whatsapp-button-inner {
          position: relative;
          z-index: 2;

          display: grid;
          width: 100%;
          height: 100%;

          place-items: center;
          border-radius: 50%;

          background: linear-gradient(
            145deg,
            #35e879,
            #25d366 65%,
            #1db954
          );
        }

        .whatsapp-icon {
          width: 31px;
          height: 31px;

          color: #ffffff;

          transition: transform 0.3s ease;
        }

        .whatsapp-button:hover .whatsapp-icon {
          transform: rotate(-8deg) scale(1.08);
        }

        /* ONLINE INDICATOR */

        .whatsapp-online {
          position: absolute;

          top: 2px;
          right: 2px;

          z-index: 4;

          width: 12px;
          height: 12px;

          border: 2px solid #ffffff;
          border-radius: 50%;

          background: #12c76a;

          animation: online-blink 2s ease-in-out infinite;
        }

        /* ANIMATIONS */

        @keyframes whatsapp-ripple {
          0% {
            transform: scale(1);
            opacity: 0.75;
          }

          100% {
            transform: scale(1.85);
            opacity: 0;
          }
        }

        @keyframes support-entrance {
          from {
            opacity: 0;
            transform: translate(25px, 12px) scale(0.85);
          }

          to {
            opacity: 1;
            transform: translate(0, 0) scale(1);
          }
        }

        @keyframes support-float {
          0%, 100% {
            translate: 0 0;
          }

          50% {
            translate: 0 -4px;
          }
        }

        @keyframes support-shine {
          0%, 65%, 100% {
            left: -45%;
          }

          85% {
            left: 125%;
          }
        }

        @keyframes button-entrance {
          from {
            opacity: 0;
            transform: scale(0.4);
          }

          70% {
            transform: scale(1.13);
          }

          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes online-blink {
          0%, 100% {
            box-shadow: 0 0 0 2px rgba(18, 199, 106, 0.15);
          }

          50% {
            box-shadow: 0 0 0 5px rgba(18, 199, 106, 0.22);
          }
        }

        /* MOBILE: KEEP ORIGINAL POSITION */

        @media (max-width: 767px) {
          .whatsapp-widget {
            right: 12px;
            bottom: 12px;
            gap: 0;
          }

          .whatsapp-support {
            display: none;
          }

          .whatsapp-button {
            width: 56px;
            height: 56px;
          }

          .whatsapp-icon {
            width: 30px;
            height: 30px;
          }
        }

        /* EXTRA SMALL MOBILE */

        @media (max-width: 359px) {
          .whatsapp-widget {
            right: 9px;
            bottom: 10px;
          }

          .whatsapp-button {
            width: 52px;
            height: 52px;
          }

          .whatsapp-icon {
            width: 28px;
            height: 28px;
          }
        }

        /* REDUCED MOTION ACCESSIBILITY */

        @media (prefers-reduced-motion: reduce) {
          .whatsapp-widget *,
          .whatsapp-widget *::before,
          .whatsapp-widget *::after {
            animation: none !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </>
  );
}
