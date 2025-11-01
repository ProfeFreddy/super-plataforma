import React from "react";
import WordCloud from "react-d3-cloud";
export default function NubeDiag() {
  const data = [
    { text: "matemática", value: 8 },
    { text: "probabilidad", value: 5 },
    { text: "estadística", value: 3 },
  ];
  return (
    <div style={{ padding: 20 }}>
      <h3>Nube (diag)</h3>
      <WordCloud
        data={data}
        font="Segoe UI"
        width={800}
        height={400}
        fontSizeMapper={(w) => 18 + w.value * 8}
        rotate={() => 0}
      />
    </div>
  );
}
