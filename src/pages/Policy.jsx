import React, { useState } from 'react';

// Replace the placeholder file paths with actual Policy PDFs when they become available.
const policyCategories = [
  {
    key: 'student',
    title: 'Student Policies',
    description: 'Guidelines focused on academic conduct, attendance, and campus engagement.',
    policies: [
      { label: 'Policy 1', file: '/pdfs/student-policy-1.pdf' },
      { label: 'Policy 2', file: '/pdfs/student-policy-2.pdf' },
      { label: 'Policy 3', file: '/pdfs/student-policy-3.pdf' }
    ]
  },
  {
    key: 'faculty',
    title: 'Faculty Policies',
    description: 'Operational policies covering pedagogy, mentoring, and research responsibilities.',
    policies: [
      { label: 'Policy 1', file: '/pdfs/faculty-policy-1.pdf' },
      { label: 'Policy 2', file: '/pdfs/faculty-policy-2.pdf' },
      { label: 'Policy 3', file: '/pdfs/faculty-policy-3.pdf' }
    ]
  },
  {
    key: 'university',
    title: 'University Policies',
    description: 'Institution-wide governance covering quality assurance and institutional guidelines.',
    policies: [
      { label: 'Policy 1', file: '/pdfs/university-policy-1.pdf' },
      { label: 'Policy 2', file: '/pdfs/university-policy-2.pdf' },
      { label: 'Policy 3', file: '/pdfs/university-policy-3.pdf' }
    ]
  }
];

const handbookDocument = {
  title: 'Student Handbook',
  description: 'Comprehensive guide detailing academic policies, support services, and campus life.',
  file: '/pdfs/Student Handbook.pdf'
};

const Policy = () => {
  const [activeCategory, setActiveCategory] = useState(null);

  const containerStyle = {
    minHeight: '80vh',
    padding: '4rem 2rem',
    background: 'linear-gradient(135deg, rgba(24, 46, 55, 0.95), rgba(16, 30, 39, 0.95))',
    color: '#D5AB5D',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  };

  const sectionWrapperStyle = {
    width: '100%',
    maxWidth: '960px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    marginTop: '3rem'
  };

  const categoryHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: '1.25rem 1.5rem',
    background: 'linear-gradient(145deg, rgba(32, 57, 71, 0.95), rgba(18, 31, 40, 0.95))',
    borderRadius: '18px',
    border: '1px solid rgba(213, 171, 93, 0.35)',
    cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(0,0,0,0.35)',
    transition: 'transform 0.25s ease, box-shadow 0.25s ease'
  };

  const policyListStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    padding: '1.5rem',
    borderRadius: '0 0 18px 18px',
    background: 'rgba(15, 27, 35, 0.75)',
    border: '1px solid rgba(213, 171, 93, 0.15)',
    borderTop: 'none'
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

  const toggleCategory = (key) => {
    setActiveCategory((prev) => (prev === key ? null : key));
  };

  const renderPolicyRow = ({ label, file }) => (
    <div
      key={label}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 1.25rem',
        borderRadius: '12px',
        background: 'linear-gradient(120deg, rgba(32, 57, 71, 0.85), rgba(18, 31, 40, 0.85))',
        border: '1px solid rgba(213, 171, 93, 0.25)',
        boxShadow: '0 10px 18px rgba(0,0,0,0.3)'
      }}
    >
      <span style={{ fontWeight: 600, color: '#FFD870' }}>{label}</span>
      <button
        type="button"
        style={{
          ...buttonStyle,
          flex: 'initial',
          padding: '0.6rem 0.9rem',
          minWidth: '120px'
        }}
        onClick={() => window.open(file, '_blank', 'noopener,noreferrer')}
      >
        View
      </button>
    </div>
  );

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
        Access focused policy clusters for students, faculty, and university governance. Select a section to reveal quick links to the specific policies.
      </p>

      <div style={sectionWrapperStyle}>
        {policyCategories.map(({ key, title, description, policies }) => {
          const isActive = activeCategory === key;
          return (
            <div key={key}>
              <div
                style={{
                  ...categoryHeaderStyle,
                  transform: isActive ? 'translateY(-6px)' : 'translateY(0)',
                  boxShadow: isActive
                    ? '0 22px 36px rgba(0,0,0,0.5)'
                    : '0 12px 24px rgba(0,0,0,0.35)'
                }}
                onClick={() => toggleCategory(key)}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#FFD870' }}>{title}</h2>
                  <p style={{ margin: '0.35rem 0 0', color: 'rgba(255,255,255,0.75)', fontSize: '0.95rem' }}>{description}</p>
                </div>
                <span
                  style={{
                    fontSize: '1.4rem',
                    color: '#FFD870',
                    transition: 'transform 0.25s ease'
                  }}
                >
                  {isActive ? '−' : '+'}
                </span>
              </div>
              {isActive && (
                <div style={policyListStyle}>
                  {policies.map(renderPolicyRow)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: '960px',
          marginTop: '3.5rem'
        }}
      >
        <div
          style={{
            background: 'linear-gradient(145deg, rgba(32, 57, 71, 0.95), rgba(18, 31, 40, 0.95))',
            borderRadius: '24px',
            border: '1px solid rgba(213, 171, 93, 0.35)',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: '0 18px 36px rgba(0,0,0,0.45)'
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#FFD870' }}>Student Handbook</h2>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)' }}>{handbookDocument.description}</p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              style={buttonStyle}
              onClick={() => window.open(handbookDocument.file, '_blank', 'noopener,noreferrer')}
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
                link.href = handbookDocument.file;
                link.download = handbookDocument.file.split('/').pop();
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
            >
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Policy;
