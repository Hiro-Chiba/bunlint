import { ImageResponse } from "next/og";

export const size = {
  width: 128,
  height: 128,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1d4ed8, #60a5fa)",
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            width: "100%",
            height: "100%",
            borderRadius: 32,
            border: "4px solid rgba(248, 250, 252, 0.65)",
            backgroundColor: "rgba(15, 23, 42, 0.2)",
            padding: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                flex: 1,
                height: 16,
                borderRadius: 9999,
                backgroundColor: "rgba(248, 250, 252, 0.9)",
              }}
            />
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 9999,
                backgroundColor: "rgba(248, 250, 252, 0.9)",
              }}
            />
          </div>
          <div
            style={{
              height: 16,
              borderRadius: 9999,
              backgroundColor: "rgba(248, 250, 252, 0.75)",
            }}
          />
          <div
            style={{
              height: 16,
              borderRadius: 9999,
              backgroundColor: "rgba(248, 250, 252, 0.75)",
            }}
          />
          <div
            style={{
              height: 16,
              borderRadius: 9999,
              backgroundColor: "rgba(248, 250, 252, 0.75)",
            }}
          />
        </div>
      </div>
    ),
    {
      status: 200,
    },
  );
}
