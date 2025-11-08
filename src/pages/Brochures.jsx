import React from "react";

const Brochures = () => {
	return (
		<div style={{
			minHeight: "80vh",
			padding: "4rem 2rem",
			background: "linear-gradient(135deg, rgba(24, 46, 55, 0.95), rgba(16, 30, 39, 0.95))",
			color: "#D5AB5D",
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			textAlign: "center"
		}}>
			<h1 style={{
				fontSize: "2.5rem",
				marginBottom: "1.5rem",
				textTransform: "uppercase",
				letterSpacing: "3px",
				textShadow: "0 0 20px rgba(213, 171, 93, 0.5)"
			}}>
				Programme Brochures
			</h1>
			<p style={{
				maxWidth: "720px",
				fontSize: "1.1rem",
				lineHeight: 1.6,
				color: "rgba(255, 255, 255, 0.8)"
			}}>
				Please check back soon—the brochures section is being updated to include the latest programme
				handbooks and curriculum documents. If you need any brochure immediately, reach out to the IQAC
				team via the contact information on the dashboard.
			</p>
		</div>
	);
};

export default Brochures;