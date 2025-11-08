import React from 'react';

const documents = [
  {
    title: 'Student Handbook',
    description: 'Comprehensive guidelines covering academic policies, conduct, and campus resources.',
    file: '/pdfs/Student Handbook.pdf'
  }
];

const Policy = () => {
  const containerStyle = {
    minHeight: '80vh',
    padding: '4rem 2rem',
    background: 'linear-gradient(135deg, rgba(24, 46, 55, 0.95), rgba(16, 30, 39, 0.95))',
    color: '#D5AB5D',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  };

  const cardsWrapperStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '2.5rem',
    width: '100%',
    maxWidth: '960px',
    marginTop: '3rem'
  };

  const cardStyle = {
    background: 'linear-gradient(145deg, rgba(32, 57, 71, 0.95), rgba(18, 31, 40, 0.95))',
    borderRadius: '24px',
    border: '1px solid rgba(213, 171, 93, 0.35)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    boxShadow: '0 18px 36px rgba(0,0,0,0.45)',
    transition: 'transform 0.35s ease, box-shadow 0.35s ease',
    textAlign: 'left',
    color: 'rgba(255,255,255,0.85)'
  };

  const buttonStyle = {
    flex: 1,
    padding: '0.75rem 1rem',
    borderRadius: '12px',
    border: '1px solid rgba(213, 171, 93, 0.6)',
    background: 'linear-gradient(135deg, rgba(213, 171, 93, 0.85), rgba(255, 215, 0, 0.85))',
    color: '#0F1B23',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.25s ease, box-shadow 0.25s ease'
  };

  return (
    <div style={containerStyle}>
      <h1
        style={{
          fontSize: '3rem',
          marginBottom: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '4px',
          textAlign: 'center',
          textShadow: '0 0 24px rgba(213, 171, 93, 0.55)',
          fontFamily: "'Playfair Display', serif"
        }}
      >
        Policy Documents
      </h1>
      <p
        style={{
          maxWidth: '720px',
          fontSize: '1.1rem',
          lineHeight: 1.7,
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.8)'
        }}
      >
        Access the latest institutional policies and student guidelines. Each document opens in a new tab for easy viewing and download.
      </p>

      <div style={cardsWrapperStyle}>
        {documents.map(({ title, description, file }) => (
          <div
            key={title}
            style={cardStyle}
            onMouseEnter={(event) => {
              event.currentTarget.style.transform = 'translateY(-10px)';
              event.currentTarget.style.boxShadow = '0 28px 48px rgba(0,0,0,0.55)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.transform = 'translateY(0)';
              event.currentTarget.style.boxShadow = '0 18px 36px rgba(0,0,0,0.45)';
            }}
          >
            <h2 style={{
              margin: 0,
              fontSize: '1.5rem',
              color: '#FFD870'
            }}>
              {title}
            </h2>
            <p style={{
              margin: 0,
              lineHeight: 1.6
            }}>
              {description}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
              <button
                type="button"
                style={buttonStyle}
                onClick={() => window.open(file, '_blank', 'noopener,noreferrer')}
              >
                View PDF
              </button>
              <button
                type="button"
                style={{
                  ...buttonStyle,
                  background: 'transparent',
                  color: '#D5AB5D'
                }}
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = file;
                  link.download = file.split('/').pop();
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                Download
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Policy;
