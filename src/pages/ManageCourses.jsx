import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './ManageCourses.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ManageCourses() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [formData, setFormData] = useState({
    courseCode: '',
    courseName: '',
    year: new Date().getFullYear().toString(),
    semester: 1,
    school: 'SoCSE',
    programme: 'BTech',
    credits: 4
  });

  // Check if user is admin
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Fetch courses
  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/courses`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch courses');
      }

      const data = await response.json();
      setCourses(data.courses || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching courses:', err);
      setError('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const nextValue =
      name === 'courseCode'
        ? value.toUpperCase().trim()
        : value;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'semester' || name === 'credits' ? parseInt(nextValue) : nextValue
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const codeRegex = /^[A-Z]{2,4}\d{3}$/i;
    if (!codeRegex.test(formData.courseCode)) {
      alert('Course Code must be 2-4 letters followed by 3 digits (e.g., CS101).');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const url = editingCourse 
        ? `${API_URL}/api/courses/${editingCourse._id}`
        : `${API_URL}/api/courses`;
      
      const method = editingCourse ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save course');
      }

      const data = await response.json();
      
      // Update local state
      if (editingCourse) {
        setCourses(courses.map(c => c._id === data.course._id ? data.course : c));
      } else {
        setCourses([...courses, data.course]);
      }

      // Reset form
      closeModal();
      
    } catch (err) {
      console.error('Error saving course:', err);
      alert(err.message);
    }
  };

  const handleEdit = (course) => {
    setEditingCourse(course);
    setFormData({
      courseCode: course.courseCode,
      courseName: course.courseName,
      year: course.year,
      semester: course.semester,
      school: course.school,
      programme: course.programme,
      credits: course.credits
    });
    setShowModal(true);
  };

  const handleDelete = async (courseId) => {
    if (!confirm('Are you sure you want to delete this course? This will also delete all associated assignments.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/courses/${courseId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete course');
      }

      setCourses(courses.filter(c => c._id !== courseId));
    } catch (err) {
      console.error('Error deleting course:', err);
      alert('Failed to delete course');
    }
  };

  const openCreateModal = () => {
    setEditingCourse(null);
    setFormData({
      courseCode: '',
      courseName: '',
      year: new Date().getFullYear().toString(),
      semester: 1,
      school: 'SoCSE',
      programme: 'BTech',
      credits: 4
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCourse(null);
  };

  const viewCourseDetails = (courseId) => {
    navigate(`/courses/${courseId}`);
  };

  if (loading) {
    return (
      <div className="manage-courses-container">
        <div className="loading">Loading courses...</div>
      </div>
    );
  }

  return (
    <div className="manage-courses-container">
      <div className="page-header">
        <h1>Manage Courses</h1>
        <button className="btn-primary" onClick={openCreateModal}>
          + Create New Course
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="courses-table-container">
        <table className="courses-table">
          <thead>
            <tr>
              <th>Course ID</th>
              <th>Course Code</th>
              <th>Course Name</th>
              <th>School</th>
              <th>Programme</th>
              <th>Semester</th>
              <th>Credits</th>
              <th>Members</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {courses.length === 0 ? (
              <tr>
                <td colSpan="9" className="no-data">No courses found. Create your first course!</td>
              </tr>
            ) : (
              courses.map(course => (
                <tr key={course._id}>
                  <td className="course-id">{course.courseId}</td>
                  <td><strong>{course.courseCode}</strong></td>
                  <td>{course.courseName}</td>
                  <td>{course.school}</td>
                  <td>{course.programme}</td>
                  <td>Sem {course.semester}</td>
                  <td>{course.credits}</td>
                  <td>{course.courseMembers?.length || 0}</td>
                  <td className="actions">
                    <button 
                      className="btn-view" 
                      onClick={() => viewCourseDetails(course._id)}
                      title="View Details"
                    >
                      View
                    </button>
                    <button 
                      className="btn-edit" 
                      onClick={() => handleEdit(course)}
                      title="Edit Course"
                    >
                      Edit
                    </button>
                    <button 
                      className="btn-delete" 
                      onClick={() => handleDelete(course._id)}
                      title="Delete Course"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCourse ? 'Edit Course' : 'Create New Course'}</h2>
              <button className="close-btn" onClick={closeModal}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="course-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="courseCode">Course Code *</label>
                  <input
                    type="text"
                    id="courseCode"
                    name="courseCode"
                    value={formData.courseCode}
                    onChange={handleInputChange}
                    placeholder="e.g., CS101"
                  />
                  <small>Format: 2-4 letters + 3 digits (e.g., CS101, MATH201)</small>
                </div>

                <div className="form-group">
                  <label htmlFor="courseName">Course Name *</label>
                  <input
                    type="text"
                    id="courseName"
                    name="courseName"
                    value={formData.courseName}
                    onChange={handleInputChange}
                    placeholder="e.g., Data Structures and Algorithms"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="year">Year *</label>
                  <input
                    type="text"
                    id="year"
                    name="year"
                    value={formData.year}
                    onChange={handleInputChange}
                    placeholder="2024"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="semester">Semester *</label>
                  <select
                    id="semester"
                    name="semester"
                    value={formData.semester}
                    onChange={handleInputChange}
                    required
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                      <option key={sem} value={sem}>Semester {sem}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="credits">Credits *</label>
                  <input
                    type="number"
                    id="credits"
                    name="credits"
                    value={formData.credits}
                    onChange={handleInputChange}
                    min="1"
                    max="10"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="school">School *</label>
                  <select
                    id="school"
                    name="school"
                    value={formData.school}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="SoCSE">SoCSE (School of Computer Science & Engineering)</option>
                    <option value="SoECE">SoECE (School of Electronics & Communication)</option>
                    <option value="SoME">SoME (School of Mechanical Engineering)</option>
                    <option value="SoCE">SoCE (School of Civil Engineering)</option>
                    <option value="SoAS">SoAS (School of Applied Sciences)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="programme">Programme *</label>
                  <select
                    id="programme"
                    name="programme"
                    value={formData.programme}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="BTech">BTech</option>
                    <option value="MTech">MTech</option>
                    <option value="BCA">BCA</option>
                    <option value="MCA">MCA</option>
                    <option value="BSc">BSc</option>
                    <option value="MSc">MSc</option>
                  </select>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingCourse ? 'Update Course' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
