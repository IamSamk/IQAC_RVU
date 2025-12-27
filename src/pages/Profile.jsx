import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';
import './Profile.css';

export default function Profile() {
  const navigate = useNavigate();
  const { user, getToken } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [profileData, setProfileData] = useState({
    username: '',
    email: '',
    role: '',
    school: '',
    assignedCourses: [],
    profileImage: null
  });
  
  const [assignments, setAssignments] = useState([]);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    if (!user || !user._id) {
      navigate('/login');
      return;
    }
    fetchUserProfile();
    fetchUserAssignments();
  }, [user, navigate]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      setProfileData({
        username: data.username || '',
        email: data.email || '',
        role: data.role || '',
        school: data.school || '',
        assignedCourses: data.assignedCourses || [],
        profileImage: data.profileImage || null
      });
      
      if (data.profileImage) {
        setImagePreview(`${API_BASE_URL}/api/auth/profile-image/${user._id}`);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      showMessage('Failed to load profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserAssignments = async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/api/tasks/user/${user._id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAssignments(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showMessage('Image size must be less than 5MB', 'error');
      return;
    }
    
    if (!file.type.startsWith('image/')) {
      showMessage('Please select an image file', 'error');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload immediately
    const formData = new FormData();
    formData.append('profileImage', file);

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/api/auth/upload-profile-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      showMessage('Profile picture updated successfully', 'success');
    } catch (err) {
      console.error('Error uploading image:', err);
      showMessage('Failed to upload image', 'error');
      // Revert preview if upload fails
      if (profileData.profileImage) {
        setImagePreview(`${API_BASE_URL}/api/auth/profile-image/${user._id}`);
      } else {
        setImagePreview(null);
      }
    }
  };

  const showMessage = (text, type) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleAssignmentClick = (assignment) => {
    // Navigate to Teaching and Learning page with the assignment context
    // We might need to pass state or query params
    navigate('/teaching-and-learning', { state: { activeAssignmentId: assignment._id } });
  };

  if (loading) {
    return <div className="profile-loading">Loading profile...</div>;
  }

  return (
    <div className="profile-container">
      <h1 className="profile-title">My Profile</h1>
      
      {message.text && (
        <div className={`profile-message ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Profile Picture Section */}
      <div className="profile-section profile-picture-section">
        <h2 className="section-title">Profile Picture</h2>
        <div className="profile-image-container">
          {imagePreview ? (
            <img src={imagePreview} alt="Profile" className="profile-image" />
          ) : (
            <div className="profile-image-placeholder">?</div>
          )}
        </div>
        <label className="choose-image-btn">
          Choose Image
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleImageChange} 
            style={{ display: 'none' }} 
          />
        </label>
        <p className="image-help-text">Max size: 5MB. Supported formats: JPG, PNG, GIF</p>
      </div>

      {/* Basic Information Section */}
      <div className="profile-section">
        <h2 className="section-title">Basic Information</h2>
        <div className="info-grid">
          <div className="info-item">
            <label>USERNAME</label>
            <div className="info-value">{profileData.username}</div>
          </div>
          <div className="info-item">
            <label>EMAIL</label>
            <div className="info-value">{profileData.email}</div>
          </div>
          <div className="info-item">
            <label>ROLE</label>
            <div className="info-value">
              <span className="role-badge">{profileData.role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* My Courses Section */}
      <div className="profile-section">
        <h2 className="section-title">My Courses</h2>
        {profileData.assignedCourses && profileData.assignedCourses.length > 0 ? (
          <div className="courses-grid">
            {profileData.assignedCourses.map((course, index) => (
              <div key={index} className="course-card">
                <div className="course-code">{course.courseId}</div>
                <div className="course-name">{course.courseName}</div>
                <div className="course-role">Role: {course.role}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-data">No courses assigned yet.</div>
        )}
      </div>

      {/* Current Assignments Section */}
      <div className="profile-section">
        <h2 className="section-title">Current Assignments</h2>
        {assignments && assignments.length > 0 ? (
          <div className="assignments-list">
            {assignments.map((assignment) => (
              <div 
                key={assignment._id} 
                className="assignment-item"
                onClick={() => handleAssignmentClick(assignment)}
              >
                <div className="assignment-info">
                  <div className="assignment-title">{assignment.title}</div>
                  <div className="assignment-course">
                    {assignment.courseRef ? 
                      `${assignment.courseRef.courseCode} - ${assignment.courseRef.courseName}` : 
                      `${assignment.courseCode || ''} - ${assignment.courseName || ''}`
                    }
                  </div>
                  <div className="assignment-deadline">
                    Due: {new Date(assignment.deadline).toLocaleDateString()}
                  </div>
                </div>
                <div className={`assignment-status status-${assignment.status}`}>
                  {assignment.status.replace('-', ' ')}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-data">No active assignments.</div>
        )}
      </div>
    </div>
  );
}
