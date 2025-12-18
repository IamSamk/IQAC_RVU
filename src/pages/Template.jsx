// Template.jsx
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';

const getToken = () => sessionStorage.getItem('token') || localStorage.getItem('token');

const Template = () => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const { user: contextUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState('viewer');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  // Check authentication FIRST
  useEffect(() => {
    let user = null;
    let token = null;
    
    // First check AuthContext
    if (contextUser) {
      user = contextUser;
      // Check both sessionStorage and localStorage for token
      token = sessionStorage.getItem('token') || localStorage.getItem('token');
    } else {
      // Fallback to localStorage/sessionStorage
      try {
        user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
        token = sessionStorage.getItem('token') || localStorage.getItem('token');
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
    
    console.log('🔐 Auth check - User exists:', !!user, 'Token exists:', !!token);
    
    if (user && user._id && token) {
      setUserRole(user.role || 'viewer');
      setIsAuthenticated(true);
    } else {
      setUserRole('viewer');
      setIsAuthenticated(false);
    }
    
    setAuthChecked(true);
  }, [contextUser]);

  // THEN fetch templates after auth is checked
  useEffect(() => {
    // Wait for auth check to complete
    if (!authChecked) return;
    // Only fetch if authenticated
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    
    const fetchTemplates = async () => {
      try {
        const token = getToken();
        console.log('🔍 Fetching templates, token exists:', !!token);
        
        if (!token) {
          console.error('❌ No token available');
          setLoading(false);
          return;
        }
        
        const response = await fetch(`${API_BASE_URL}/api/assignment-templates`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('📡 Template fetch response:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          const templates = data.templates || [];
          console.log('✅ Templates received:', templates.length);
          
          // Group templates by parentFolder - store FULL template objects, not just names
          const grouped = {};
          templates.forEach(template => {
            const folder = template.parentFolder || 'Root Level';
            if (!grouped[folder]) {
              grouped[folder] = [];
            }
            grouped[folder].push(template); // Store full template object
          });
          
          // Convert to categories array format
          const cats = Object.keys(grouped).map(folderName => ({
            name: folderName,
            templates: grouped[folderName] // Array of full template objects
          }));
          
          console.log('📁 Categories created:', cats);
          setCategories(cats);
        } else {
          console.error('❌ Failed to fetch templates:', response.status);
        }
        setLoading(false);
      } catch (error) {
        console.error('💥 Error fetching templates:', error);
        setLoading(false);
      }
    };
    
    fetchTemplates();
  }, [isAuthenticated, authChecked]);

  // Handle template download
  const handleDownload = async (template) => {
    try {
      const token = getToken();
      if (!token) {
        alert('Please login to download templates');
        return;
      }

      // Fetch the template file
      const response = await fetch(`${API_BASE_URL}/api/assignment-templates/${template._id}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${template.templateName}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        console.log('✅ Downloaded:', template.templateName);
      } else {
        console.error('❌ Download failed:', response.status);
        alert('Failed to download template');
      }
    } catch (error) {
      console.error('💥 Download error:', error);
      alert('Error downloading template');
    }
  };

  // Handle template view (open in new tab)
  const handleView = async (template) => {
    try {
      const token = getToken();
      if (!token) {
        alert('Please login to view templates');
        return;
      }

      // Open in new window with token in URL (since we can't set headers for window.open)
      const url = `${API_BASE_URL}/api/assignment-templates/${template._id}/download?inline=true&token=${encodeURIComponent(token)}`;
      window.open(url, '_blank');
      console.log('👁️ Viewing:', template.templateName);
    } catch (error) {
      console.error('💥 View error:', error);
      alert('Error viewing template');
    }
  };

  // Show loading while checking auth
  if (!authChecked || loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#182E37',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#D5AB5D',
        fontSize: '1.5rem'
      }}>
        Loading templates...
      </div>
    );
  }

  // Check authentication AFTER auth check completes
  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#182E37',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#D5AB5D',
        fontSize: '1.5rem'
      }}>
        Redirecting...
      </div>
    );
  }

  // Styles
  const containerStyle = {
    minHeight: '100vh',
    background: '#182E37',
    fontFamily: 'Segoe UI, sans-serif',
    padding: '2vw',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
  };

  const headerStyle = {
    background: '#223b47',
    border: '2px solid #D5AB5D',
    borderRadius: '8px',
    padding: '1.2rem 2rem',
    margin: '2vw 0 3vw 0',
    fontSize: '1.7rem',
    color: '#D5AB5D',
    fontWeight: 600,
    letterSpacing: '1px',
    width: '100%',
    maxWidth: 700,
    textAlign: 'center',
    boxShadow: '0 4px 16px rgba(213,171,93,0.08)',
  };

  // Layout for categories and templates
  const mainRowStyle = {
    display: 'flex',
    flexDirection: selectedCategory !== null ? 'row' : 'column',
    alignItems: selectedCategory !== null ? 'flex-start' : 'center',
    justifyContent: 'center',
    gap: selectedCategory !== null ? '2vw' : '0',
    width: '100%',
    maxWidth: 1100,
    minHeight: '50vh',
  };

  const categoriesListStyle = {
    background: selectedCategory !== null ? '#223b47' : 'transparent',
    border: selectedCategory !== null ? '2px solid rgba(150, 130, 13, 0.3)' : 'none',
    borderRadius: '0px',
    color: '#fff',
    padding: selectedCategory !== null ? '2rem 1.2rem' : '0',
    minWidth: selectedCategory !== null ? '18vw' : '0',
    maxWidth: selectedCategory !== null ? '28vw' : 'none',
    width: selectedCategory !== null ? '100%' : 'auto',
    flex: selectedCategory !== null ? '1 1 22vw' : 'none',
    marginBottom: selectedCategory !== null ? '2vw' : '0',
    boxShadow: selectedCategory !== null ? '0 4px 16px rgba(24,46,55,0.10)' : 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontSize: '1.1rem',
    textAlign: 'center',
    gap: selectedCategory !== null ? '0' : '1.5rem',
  };

  const categoryButtonStyle = (active) => ({
    background: active ? '#D5AB5D' : '#223b47',
    color: active ? '#223b47' : '#D5AB5D',
    border: '2px solid #D5AB5D',
    borderRadius: '6px',
    padding: '1rem 2.5rem',
    fontWeight: 600,
    fontSize: '1.15rem',
    margin: '0.5rem 0',
    cursor: 'pointer',
    boxShadow: active ? '0 2px 8px rgba(213,171,93,0.18)' : 'none',
    transition: 'background 0.2s, color 0.2s, transform 0.15s',
    width: '100%',
    minWidth: '260px',
    maxWidth: '320px',
    textAlign: 'center',
    display: 'block',
  });

  const templatesBoxStyle = {
    background: '#223b47',
    border: '2px solid rgba(150, 130, 13, 0.3)',
    borderRadius: '0px',
    color: '#fff',
    padding: '2rem 2vw',
    minWidth: '32vw',
    maxWidth: '60vw',
    width: '100%',
    flex: '2 1 48vw',
    minHeight: '320px',
    boxShadow: '0 4px 16px rgba(24,46,55,0.10)',
    fontSize: '1.1rem',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  };

  const templateListStyle = {
    marginTop: '1.2rem',
    paddingLeft: '1.2rem',
    color: '#fff',
    fontSize: '1.08rem',
  };

  // Responsive
  const mediaQuery = `@media (max-width: 700px) { .template-main-row { flex-direction: column; gap: 1.5rem; align-items: stretch; } }`;

  return (
    <div style={containerStyle}>
      <style>{mediaQuery}</style>
      <div style={headerStyle}>SOCSE TEMPLATES</div>
      <div className="template-main-row" style={mainRowStyle}>
        <div style={categoriesListStyle}>
          {categories.map((cat, idx) => (
            <button
              key={cat.name}
              style={categoryButtonStyle(selectedCategory === idx)}
              onClick={() => setSelectedCategory(idx)}
            >
              {cat.name}
            </button>
          ))}
        </div>
        {selectedCategory !== null && (
          <div style={templatesBoxStyle}>
            <div style={{ fontWeight: 600, marginBottom: '1rem', color: '#D5AB5D' }}>
              Templates in {categories[selectedCategory].name}
            </div>
            <div style={{ marginTop: '1.2rem', color: '#fff' }}>
              {categories[selectedCategory].templates.map((template, i) => (
                <div key={template._id || i} style={{
                  background: '#182E37',
                  padding: '1rem',
                  borderRadius: '6px',
                  marginBottom: '0.75rem',
                  border: '1px solid rgba(213, 171, 93, 0.3)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem', color: '#fff' }}>
                      {template.templateName}
                    </div>
                    {template.description && (
                      <div style={{ fontSize: '0.85rem', color: '#999', marginTop: '4px' }}>
                        {template.description}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                    <button
                      onClick={() => handleView(template)}
                      style={{
                        background: '#223b47',
                        color: '#D5AB5D',
                        border: '1px solid #D5AB5D',
                        borderRadius: '4px',
                        padding: '0.5rem 1rem',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        e.target.style.background = '#D5AB5D';
                        e.target.style.color = '#182E37';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.background = '#223b47';
                        e.target.style.color = '#D5AB5D';
                      }}
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleDownload(template)}
                      style={{
                        background: '#D5AB5D',
                        color: '#182E37',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0.5rem 1rem',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        e.target.style.background = '#c49a4d';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.background = '#D5AB5D';
                      }}
                    >
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Template;
