import { NextResponse } from "next/server";
import sharp from "sharp";
import satori from "satori";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

type Body = {
  title: string;
  message: string;
  backgroundUrl: string;
  mode?: "binary" | "url";
};

async function fetchArrayBuffer(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch: ${url} (${res.status})`);
  return await res.arrayBuffer();
}

function safeText(s: unknown, fallback: string) {
  const v = typeof s === "string" ? s.trim() : "";
  return v || fallback;
}

// Heel simpele fit-to-box heuristic:
// - we berekenen een "gewicht" op basis van lengte van title+message
// - bij meer tekst schalen we de fontgrootte omlaag
function computeFontScale(title: string, message: string) {
  const units = title.length * 1.4 + message.length; // title telt iets zwaarder
  // units ~ 0-600+
  if (units <= 160) return 1.0;
  if (units <= 260) return 0.9;
  if (units <= 360) return 0.8;
  if (units <= 460) return 0.72;
  if (units <= 560) return 0.66;
  return 0.6; // echt veel tekst
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const title = safeText(body.title, "Titel");
    const message = safeText(body.message, "Bericht");
    const backgroundUrl = safeText(body.backgroundUrl, "");

    if (!backgroundUrl) {
      return NextResponse.json(
        { error: "backgroundUrl is required" },
        { status: 400 }
      );
    }

    const mode = body.mode ?? "binary";

    const [bgBuf, fontRegular, fontSemibold] = await Promise.all([
      fetchArrayBuffer(backgroundUrl).then((b) => Buffer.from(b)),
      fetchArrayBuffer(new URL("/fonts/Inter-Regular.ttf", req.url).toString()).then((b) =>
        Buffer.from(b)
      ),
      fetchArrayBuffer(new URL("/fonts/Inter-SemiBold.ttf", req.url).toString()).then((b) =>
        Buffer.from(b)
      )
    ]);

        const scale = computeFontScale(title, message);
    const titleSize = Math.round(64 * scale);
    const bodySize = Math.round(46 * scale);

    // 1080x1080 base
    const base = sharp(bgBuf).resize(1080, 1080, { fit: "cover" });

    // Text overlay -> SVG via satori (pure JS object, geen JSX)
    const svg = await (satori as any)(
      {
  type: "div",
  props: {
    style: {
      width: "1080px",
      height: "1080px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      padding: "80px",
      color: "#1e0033",
      textAlign: "center"
    },
    children: [
      {
        type: "div",
        props: {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "32px",           // meer ruimte tussen title & message
            maxWidth: "900px",     // zorgt voor wrap
          },
          children: [
            {
              type: "div",
              props: {
                style: {
                  fontFamily: "Inter",
                  fontWeight: 700,
                  fontSize: `${Math.round(titleSize * 1.35)}px`,   // TITEL VEEL GROTER
                  lineHeight: 1.1,
                },
                children: title
              }
            },
            {
              type: "div",
              props: {
                style: {
                  fontFamily: "Inter",
                  fontWeight: 400,
                  fontSize: `${Math.round(bodySize * 1.25)}px`,    // BODY OOK GROTER
                  lineHeight: 1.3,
                  opacity: 0.9
                },
                children: message
              },
            },
          ],
        },
      },
    ],
  },
},

      {
        width: 1080,
        height: 1080,
        fonts: [
          { name: "Inter", data: fontRegular, weight: 400, style: "normal" },
          { name: "Inter", data: fontSemibold, weight: 700, style: "normal" },
        ],
      }
    );

    const overlayPng = await sharp(Buffer.from(svg)).png().toBuffer();

    const outPng = await base
      .composite([{ input: overlayPng, top: 0, left: 0 }])
      .png()
      .toBuffer();

    if (mode === "url") {
      const fileName = `social/${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}.png`;

      const blob = await put(fileName, outPng, {
        access: "public",
        contentType: "image/png",
      });

      return NextResponse.json({ url: blob.url }, { status: 200 });
    }

    return new NextResponse(outPng as any, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });


  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
