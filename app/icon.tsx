import { ImageResponse } from "next/server";

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
          color: "#f8fafc",
          fontSize: 64,
          fontWeight: 700,
          letterSpacing: "-0.05em",
        }}
      >
        文
      </div>
    ),
    {
      status: 200,
    },
  );
}
