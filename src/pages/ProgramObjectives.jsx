import React from "react";
import { useNavigate } from "react-router-dom";

const programs = [
  {
    key: "btech",
    title: "B.Tech",
    description: "Programme Educational Objectives for the Bachelor of Technology curriculum.",
    file: "/pdfs/btech-peo.pdf"
  },
  {
    key: "bsc",
    title: "B.Sc",
    description: "Programme Educational Objectives for the Bachelor of Science pathway.",
    file: "/pdfs/bsc-peo.pdf"
  },
  {
    key: "bca",
    title: "BCA",
    description: "Programme Educational Objectives for the Bachelor of Computer Applications programme.",
    file: "/pdfs/bca-peo.pdf"
  },
  {
    key: "mtech",
    title: "M.Tech",
    description: "Programme Educational Objectives for the Master of Technology specialisations.",
    file: "/pdfs/mtech-peo.pdf"
  }
];

const ProgramObjectives = () => {
  const navigate = useNavigate();

  const containerStyle = {
    minHeight: "80vh",
    padding: "4rem 2rem",
    background: "linear-gradient(135deg, rgba(24, 46, 55, 0.95), rgba(16, 30, 39, 0.95))",
    color: "#D5AB5D",
    display: "flex",
    flexDirection: "column",
    alignItems: "center"
  };

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "2.5rem",
    width: "100%",
    maxWidth: "1080px",
    marginTop: "3rem"
  };

  const cardStyle = {
    background: "linear-gradient(145deg, rgba(32, 57, 71, 0.95), rgba(18, 31, 40, 0.95))",
    borderRadius: "24px",
    border: "1px solid rgba(213, 171, 93, 0.35)",
    padding: "2rem",
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
    boxShadow: "0 18px 36px rgba(0,0,0,0.45)",
    transition: "transform 0.35s ease, box-shadow 0.35s ease",
    color: "rgba(255,255,255,0.85)",
    textAlign: "left"
  };

  const buttonStyle = {
    padding: "0.75rem 1rem",
    borderRadius: "12px",
    border: "1px solid rgba(213, 171, 93, 0.6)",
    background: "linear-gradient(135deg, rgba(213, 171, 93, 0.85), rgba(255, 215, 0, 0.85))",
    color: "#0F1B23",
    fontWeight: 600,
    cursor: "pointer",
    transition: "transform 0.25s ease, box-shadow 0.25s ease"
  };

  return (
    <div style={containerStyle}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{
          alignSelf: "flex-start",
          marginBottom: "1.5rem",
          padding: "0.5rem 1rem",
          borderRadius: "10px",
          border: "1px solid rgba(213, 171, 93, 0.4)",
          background: "transparent",
          color: "#D5AB5D",
          cursor: "pointer"
        }}
      >
        ← Back
      </button>

      <h1
        style={{
          fontSize: "3rem",
          marginBottom: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "4px",
          textAlign: "center",
          textShadow: "0 0 24px rgba(213, 171, 93, 0.55)",
          fontFamily: "'Playfair Display', serif"
        }}
      >
        Programme Educational Objectives
      </h1>
      <p
        style={{
          maxWidth: "760px",
          fontSize: "1.1rem",
          lineHeight: 1.7,
          textAlign: "center",
          color: "rgba(255, 255, 255, 0.8)"
        }}
      >
        Choose a programme to view the detailed Programme Educational Objectives document. Each selection opens the PDF in a new tab for easy reference or download.
      </p>

      <div style={gridStyle}>
        {programs.map(({ key, title, description, file }) => (
          <div
            key={key}
            style={cardStyle}
            onMouseEnter={(event) => {
              event.currentTarget.style.transform = "translateY(-10px)";
              event.currentTarget.style.boxShadow = "0 28px 48px rgba(0,0,0,0.55)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.transform = "translateY(0)";
              event.currentTarget.style.boxShadow = "0 18px 36px rgba(0,0,0,0.45)";
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1.6rem", color: "#FFD870" }}>{title}</h2>
            <p style={{ margin: 0, lineHeight: 1.6 }}>{description}</p>
            <button
              type="button"
              style={buttonStyle}
              onClick={() => window.open(file, "_blank", "noopener,noreferrer")}
            >
              View PDF
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProgramObjectives;
