import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './Profile.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Profile() {
  const navigate = useNavigate();
  const { user, updateUser } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
  const [selectedFile, setSelectedFile] = useState(null);

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
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/auth/profile`, {
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
        setImagePreview(`${API_URL}/api/auth/profile-image/${user._id}`);
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
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/tasks/user/${user._id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAssignments(data.tasks || []);
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showMessage('Image size must be less than 5MB', 'error');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        showMessage('Please select an image file', 'error');
        return;
      }

      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = async () => {
    if (!selectedFile) {
      showMessage('Please select an image first', 'error');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('profileImage', selectedFile);

      const response = await fetch(`${API_URL}/api/auth/upload-profile-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      showMessage('Profile image updated successfully!', 'success');
      setSelectedFile(null);
      
      // Update AuthContext if needed
      if (updateUser) {
        updateUser({ ...user, profileImage: data.profileImage });
      }
    } catch (err) {
      console.error('Error uploading image:', err);
      showMessage('Failed to upload image', 'error');
    } finally {
      setSaving(false);
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': '#ffc107',
      'in-progress': '#17a2b8',
      'submitted': '#007bff',
      'under-review': '#6c757d',
      'approved': '#28a745',
      'rejected': '#dc3545',
      'completed': '#28a745'
    };
    return colors[status] || '#6c757d';
  };

  const handleAssignmentClick = (assignmentId) => {
    navigate(`/teaching-learning?taskId=${assignmentId}`);
  };

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1>My Profile</h1>
      </div>

      {message.text && (
        <div className={`profile-message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="profile-content">
        {/* Profile Image Section */}
        <div className="profile-section profile-image-section">
          <h2>Profile Picture</h2>
          <div className="image-upload-container">
            <div className="image-preview">
              {imagePreview ? (
                <img src={imagePreview} alt="Profile" />
              ) : (
                <div className="no-image">
                  <span className="initials">
                    {profileData.username?.charAt(0).toUpperCase() || '?'}
                  </span>
                </div>
              )}
            </div>
            <div className="image-controls">
              <input
                type="file"
                id="profile-image"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
              />
              <label htmlFor="profile-image" className="btn-select-image">
                Choose Image
              </label>
              {selectedFile && (
                <button
                  onClick={handleImageUpload}
                  className="btn-upload-image"
                  disabled={saving}
                >
                  {saving ? 'Uploading...' : 'Upload'}
                </button>
              )}
            </div>
            <p className="image-info">Max size: 5MB. Supported formats: JPG, PNG, GIF</p>
          </div>
        </div>

        {/* Basic Information */}
        <div className="profile-section">
          <h2>Basic Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Username</label>
              <p>{profileData.username}</p>
            </div>
            <div className="info-item">
              <label>Email</label>
              <p>{profileData.email}</p>
            </div>
            <div className="info-item">
              <label>Role</label>
              <p className="role-badge">{profileData.role}</p>
            </div>
            {profileData.school && (
              <div className="info-item">
                <label>School</label>
                <p>{profileData.school}</p>
              </div>
            )}
          </div>
        </div>

        {/* Assigned Courses */}
        <div className="profile-section">
          <h2>My Courses</h2>
          {profileData.assignedCourses.length === 0 ? (
            <p className="no-data">You are not assigned to any courses yet.</p>
          ) : (
            <div className="courses-grid">
              {profileData.assignedCourses.map((course, index) => (
                <div key={index} className="course-card">
                  <div className="course-header">
                    <h3>{course.courseId || course.courseCode}</h3>
                    <span className={`course-role-badge ${course.role}`}>
                      {course.role}
                    </span>
                  </div>
                  <p className="course-name">{course.courseName}</p>
                  {course.assignedAt && (
                    <p className="course-date">
                      Assigned: {new Date(course.assignedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Current Assignments */}
        <div className="profile-section">
          <h2>My Current Assignments</h2>
          {assignments.length === 0 ? (
            <p className="no-data">You have no current assignments.</p>
          ) : (
            <div className="assignments-list">
              {assignments.map((assignment) => (
                <div
                  key={assignment._id}
                  className="assignment-card"
                  onClick={() => handleAssignmentClick(assignment._id)}
                >
                  <div className="assignment-header">
                    <h3>{assignment.title || assignment.assignmentType}</h3>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(assignment.status) }}
                    >
                      {assignment.status.replace(/-/g, ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="assignment-details">
                    <p className="course-info">
                      <strong>Course:</strong> {assignment.courseRef?.courseCode || assignment.courseCode} - {assignment.courseRef?.courseName || assignment.courseName}
                    </p>
                    <p className="deadline">
                      <strong>Deadline:</strong> {new Date(assignment.deadline).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="assignment-footer">
                    <span className="click-hint">Click to work on this assignment →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
