import React from "react";
import "./Research.css";

const indexingData = [
  { year: "2023", values: { SCI: 5, Scopus: 9, "Non Indexed": 14, Total: 28 } },
  { year: "2024", values: { SCI: 19, Scopus: 22, "Non Indexed": 5, Total: 46 } },
  { year: "2025", values: { SCI: 29, Scopus: 18, "Non Indexed": 4, Total: 51 } }
];

const publicationData = [
  { year: "2023", values: { Journal: 6, Conference: 20, "Book / Chapter": 2, Total: 28 } },
  { year: "2024", values: { Journal: 20, Conference: 19, "Book / Chapter": 7, Total: 46 } },
  { year: "2025", values: { Journal: 31, Conference: 14, "Book / Chapter": 6, Total: 51 } }
];

const quartileData = [
  { year: "2023", values: { Q1: 2, Q2: 1, Q3: 2, Total: 5 } },
  { year: "2024", values: { Q1: 12, Q2: 6, Q3: 1, Total: 19 } },
  { year: "2025", values: { Q1: 17, Q2: 12, Q3: 0, Total: 29 } }
];

const chartConfigs = [
  {
    title: "Indexing Comparison",
    subtitle: "SCI, Scopus, and Non-Indexed research outputs across the last three years.",
    data: indexingData,
    categories: [
      { key: "SCI", label: "SCI" },
      { key: "Scopus", label: "Scopus = Scopus-SCI" },
      { key: "Non Indexed", label: "Non Indexed" },
      { key: "Total", label: "Total" }
    ],
    colors: {
      SCI: "#2F69C3",
      Scopus: "#ADB3BC",
      "Non Indexed": "#F5BE18",
      Total: "#52A8E1"
    }
  },
  {
    title: "Publication Details",
    subtitle: "Breakdown of publications by type, mapped against the overall totals.",
    data: publicationData,
    categories: [
      { key: "Journal", label: "Journal" },
      { key: "Conference", label: "Conference" },
      { key: "Book / Chapter", label: "Book / Chapter" },
      { key: "Total", label: "Total" }
    ],
    colors: {
      Journal: "#2F69C3",
      Conference: "#EF7C27",
      "Book / Chapter": "#ADB3BC",
      Total: "#F5BE18"
    }
  },
  {
    title: "Journal Quartiles Comparison",
    subtitle: "Growth in journal publications across Q1, Q2, and Q3 quartiles.",
    data: quartileData,
    categories: [
      { key: "Q1", label: "Q1" },
      { key: "Q2", label: "Q2" },
      { key: "Q3", label: "Q3" },
      { key: "Total", label: "Total" }
    ],
    colors: {
      Q1: "#2F69C3",
      Q2: "#EF7C27",
      Q3: "#ADB3BC",
      Total: "#52A8E1"
    }
  }
];

const ChartCard = ({ title, subtitle, data, categories, colors }) => {
  const maxValue = Math.max(
    ...data.flatMap((item) => categories.map((cat) => item.values[cat.key] ?? 0))
  );
  const maxBarHeight = 220;

  const handleScroll = (direction) => {
    const safeTitle = title.replace(/"/g, '\"');
    const container = document.querySelector(
      `[data-chart="${safeTitle}"] .research-chart-grid`
    );
    if (container) {
      const scrollAmount = 260;
      container.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
  };

  return (
    <div className="research-chart-card" data-chart={title}>
      <div className="research-card-header">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <div className="research-chart-wrapper">
        <div className="research-chart-grid">
          {data.map(({ year, values }) => (
            <div key={year} className="research-year-group">
              <div className="research-bar-group">
                {categories.map(({ key, label }) => {
                  const value = values[key] ?? 0;
                  const rawHeight = maxValue === 0 ? 0 : (value / maxValue) * maxBarHeight;
                  const height = value === 0 ? 0 : Math.max(rawHeight, 28);
                  const isZero = value === 0;
                  const isTotal = key.toLowerCase() === "total";
                  return (
                    <div
                      key={key}
                      className={`research-bar-item${isTotal ? " research-bar-item-total" : ""}`}
                    >
                      <span
                        className="research-bar-value"
                        style={{ opacity: isZero ? 0.4 : 1 }}
                      >
                        {value}
                      </span>
                      <div className="research-bar-outer">
                        <div
                          className="research-bar-fill"
                          style={{
                            height: `${height}px`,
                            background: colors[key]
                          }}
                        />
                        <div className="research-bar-base" />
                      </div>
                      <span className="research-bar-category">{label}</span>
                    </div>
                  );
                })}
              </div>
              <span className="research-year-label">{year}</span>
            </div>
          ))}
        </div>
        <div className="research-scroll-controls">
          <button
            type="button"
            aria-label={`Scroll ${title} left`}
            onClick={() => handleScroll("left")}
          >
            <span>←</span>
          </button>
          <button
            type="button"
            aria-label={`Scroll ${title} right`}
            onClick={() => handleScroll("right")}
          >
            <span>→</span>
          </button>
        </div>
      </div>
      <div className="research-legend">
        {categories.map(({ key, label }) => (
          <div key={key} className="research-legend-item">
            <span
              className="research-legend-swatch"
              style={{ background: colors[key] }}
            />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Research = () => {
  return (
    <div className="research-page">
      <div className="research-heading">
        <h1>Research Performance</h1>
        <p>
          Visual insights highlighting the growth trajectory of SoCSE research outputs,
          publication venues, and journal quartile distribution between 2023 and 2025.
        </p>
      </div>

      <div className="research-chart-section">
        {chartConfigs.map((config) => (
          <ChartCard key={config.title} {...config} />
        ))}
      </div>
    </div>
  );
};

export default Research;
