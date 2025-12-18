import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { 
  COURSE_MAP, 
  getCourseNameByCode, 
  getCourseCodeByName, 
  getAllCourses, 
  isValidCourseCode,
  isValidCourseName 
} from '../utils/courseMapping';
import './Roles.css';
import { API_BASE_URL } from '../config/api';

const Roles = () => {
  const { user, getToken } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('assignments');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Template-based assignment form state
  const [assignmentForm, setAssignmentForm] = useState({
    selectedCourse: '',
    selectedTemplate: '',
    deadline: ''
  });

  // User creation form state
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user',
    school: ''
  });

  // Data state
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedCourseMembers, setSelectedCourseMembers] = useState({
    initiators: [],
    reviewers: []
  });

  // Course form state
  const [courseForm, setCourseForm] = useState({
    courseCode: '',
    courseName: '',
    year: new Date().getFullYear().toString(),
    semester: 1,
    school: 'SoCSE',
    programme: 'BTech',
    credits: 4,
    selectedInitiators: [],
    selectedReviewers: []
  });

  // Edit assignment modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);

  // Others tab state
  const [templateForm, setTemplateForm] = useState({
    templateName: '',
    category: '',
    description: '',
    parentFolder: ''
  });
  const [customTemplates, setCustomTemplates] = useState([]);
  const [bannerFile, setBannerFile] = useState(null);
  const [banners, setBanners] = useState([]);

  // Check admin access
  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    await Promise.all([fetchAssignments(), fetchUsers(), fetchCourses(), fetchTemplates(), fetchBanners()]);
  };

  const fetchAssignments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAssignments(data);
      } else {
        showMessage('Failed to fetch assignments', 'error');
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      showMessage('Error fetching assignments', 'error');
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/users`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched users data:', data); // Debug log
        console.log('Data type:', typeof data); // Debug log
        console.log('Is array:', Array.isArray(data)); // Debug log
        
        // Handle both direct array and wrapped object formats
        let usersArray;
        if (Array.isArray(data)) {
          usersArray = data;
        } else if (data && Array.isArray(data.users)) {
          usersArray = data.users;
        } else {
          console.error('Users data is not in expected format:', data);
          setUsers([]);
          showMessage('Invalid users data format', 'error');
          setLoading(false);
          return;
        }
        
        console.log('Final users array:', usersArray);
        
        // Enhance users with course information
        const enhancedUsers = usersArray.map(user => ({
          ...user,
          courseCode: user.courseIds?.[0] || '',
          courseName: user.courseIds?.[0] ? getCourseNameByCode(user.courseIds[0]) : ''
        }));
        
        setUsers(enhancedUsers);
      } else if (response.status === 401) {
        console.error('Authentication failed - redirecting to login');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to fetch users:', response.status, errorData);
        setUsers([]);
        showMessage('Failed to fetch users', 'error');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
      showMessage('Error fetching users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/courses`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCourses(data.courses || []);
      } else {
        showMessage('Failed to fetch courses', 'error');
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
      showMessage('Error fetching courses', 'error');
    }
  };

  const fetchTemplates = async () => {
    try {
      console.log('🔍 Fetching templates from:', `${API_BASE_URL}/api/assignment-templates`);
      const response = await fetch(`${API_BASE_URL}/api/assignment-templates`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      
      console.log('📡 Response status:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📦 Raw API response:', data);
        const allTemplates = data.templates || [];
        console.log('✅ Templates received:', allTemplates.length, allTemplates);
        setTemplates(allTemplates);
        // Filter custom templates (non-predefined)
        const customTemps = allTemplates.filter(t => !t.isPredefined);
        setCustomTemplates(customTemps);
        console.log('🎯 Templates state should now be:', allTemplates.length);
      } else {
        console.error('❌ API Error - Status:', response.status);
        const errorText = await response.text();
        console.error('❌ Error details:', errorText);
        showMessage('Failed to fetch templates', 'error');
      }
    } catch (error) {
      console.error('💥 Error fetching templates:', error);
      showMessage('Error fetching templates', 'error');
    }
  };

  const fetchBanners = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/banners/list`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setBanners(data.banners || []);
      } else {
        console.error('Failed to fetch banners');
      }
    } catch (error) {
      console.error('Error fetching banners:', error);
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  // Course code/name handlers
  const handleCourseCodeChange = (e) => {
    const courseCode = e.target.value;
    
    setUserForm({
      ...userForm, 
      courseCode,
      // Don't auto-fill course name
    });
  };

  const handleCourseNameChange = (e) => {
    const courseName = e.target.value;
    
    setUserForm({
      ...userForm, 
      courseName
      // Don't auto-fill course code
    });
  };

  // Edit assignment functions (Enhanced for Multiple Users)
  const handleEditAssignment = (assignment) => {
    // Extract all initiators and reviewers (both array and legacy format)
    const allInitiators = [];
    const allReviewers = [];
    
    if (assignment.assignedToInitiators && assignment.assignedToInitiators.length > 0) {
      allInitiators.push(...assignment.assignedToInitiators);
    }
    if (assignment.assignedToInitiator && 
        !allInitiators.some(init => init._id === assignment.assignedToInitiator._id)) {
      allInitiators.push(assignment.assignedToInitiator);
    }
    
    if (assignment.assignedToReviewers && assignment.assignedToReviewers.length > 0) {
      allReviewers.push(...assignment.assignedToReviewers);
    }
    if (assignment.assignedToReviewer && 
        !allReviewers.some(rev => rev._id === assignment.assignedToReviewer._id)) {
      allReviewers.push(assignment.assignedToReviewer);
    }

    setEditingAssignment({
      ...assignment,
      allInitiators,
      allReviewers,
      deadline: new Date(assignment.deadline).toISOString().split('T')[0] // Format for date input
    });
    setShowEditModal(true);
  };

  const handleUpdateAssignment = async () => {
    try {
      // Validation for multiple users
      if (!editingAssignment.allInitiators || !editingAssignment.allReviewers ||
          editingAssignment.allInitiators.length === 0 || editingAssignment.allReviewers.length === 0) {
        showMessage('Assignment must have at least one initiator and one reviewer', 'error');
        return;
      }

      // Check for user overlap
      const initiatorIds = editingAssignment.allInitiators.map(user => user._id);
      const reviewerIds = editingAssignment.allReviewers.map(user => user._id);
      const hasOverlap = initiatorIds.some(id => reviewerIds.includes(id));
      
      if (hasOverlap) {
        showMessage('Users cannot be both initiator and reviewer for the same task', 'error');
        return;
      }

      const updateData = {
        deadline: editingAssignment.deadline,
        courseCode: editingAssignment.courseCode,
        courseName: editingAssignment.courseName
      };

      // Set assignment data based on number of users
      if (editingAssignment.allInitiators.length === 1) {
        updateData.assignedToInitiator = editingAssignment.allInitiators[0]._id;
        updateData.assignedToInitiators = [editingAssignment.allInitiators[0]._id];
      } else {
        updateData.assignedToInitiators = editingAssignment.allInitiators.map(user => user._id);
        updateData.assignedToInitiator = null; // Clear legacy field for multiple users
      }

      if (editingAssignment.allReviewers.length === 1) {
        updateData.assignedToReviewer = editingAssignment.allReviewers[0]._id;
        updateData.assignedToReviewers = [editingAssignment.allReviewers[0]._id];
      } else {
        updateData.assignedToReviewers = editingAssignment.allReviewers.map(user => user._id);
        updateData.assignedToReviewer = null; // Clear legacy field for multiple users
      }

      const response = await fetch(`${API_BASE_URL}/api/tasks/${editingAssignment._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        showMessage('Assignment updated successfully!', 'success');
        setShowEditModal(false);
        await fetchAssignments();
      } else {
        const errorData = await response.json();
        showMessage(errorData.error || 'Failed to update assignment', 'error');
      }
    } catch (error) {
      console.error('Error updating assignment:', error);
      showMessage('Error updating assignment', 'error');
    }
  };

  const handleAssignmentSubmit = async (e) => {
    e.preventDefault();
    
    // Prevent duplicate submissions
    if (loading) {
      return;
    }
    
    setLoading(true);

    // Validation
    if (!assignmentForm.selectedCourse || !assignmentForm.selectedTemplate || !assignmentForm.deadline) {
      showMessage('Please select a course, template, and deadline', 'error');
      setLoading(false);
      return;
    }

    try {
      // Create task using the new template-based endpoint
      const response = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          courseId: assignmentForm.selectedCourse,
          templateId: assignmentForm.selectedTemplate,
          deadline: assignmentForm.deadline
        })
      });

      const data = await response.json();

      if (response.ok) {
        showMessage('Assignment created successfully!', 'success');
        setAssignmentForm({
          selectedCourse: '',
          selectedTemplate: '',
          deadline: ''
        });
        setSelectedCourseMembers({ initiators: [], reviewers: [] });
        await fetchAssignments();
      } else {
        showMessage(data.error || 'Failed to create assignment', 'error');
      }
    } catch (error) {
      console.error('Error creating assignment:', error);
      if (error.message === 'Failed to fetch' || error.name === 'NetworkError') {
        showMessage('Network error: Unable to connect to server. Please check your connection and try again.', 'error');
      } else {
        showMessage('Error creating assignment. Please try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUserCreate = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(userForm)
      });

      const data = await response.json();

      if (response.ok) {
        showMessage('User created successfully!', 'success');
        setUserForm({
          username: '',
          email: '',
          password: '',
          firstName: '',
          lastName: '',
          role: 'user',
          courseCode: '',
          courseName: ''
        });
        await fetchUsers();
      } else {
        showMessage(data.error || 'Failed to create user', 'error');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      showMessage('Error creating user', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUserRoleUpdate = async (userId, field, value) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ [field]: value })
      });

      if (response.ok) {
        showMessage('User updated successfully!', 'success');
        await fetchUsers();
      } else {
        const data = await response.json();
        showMessage(data.error || 'Failed to update user', 'error');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      showMessage('Error updating user', 'error');
    }
  };

  const getStatusColor = (status) => {
    const statusColors = {
      'assigned': '#6c757d',
      'file-uploaded': '#007bff',
      'in-review': '#ffc107',
      'approved-by-reviewer': '#28a745',
      'approved-by-admin': '#17a2b8',
      'completed': '#28a745'
    };
    return statusColors[status] || '#6c757d';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isDeadlineNear = (deadline) => {
    const deadlineDate = new Date(deadline);
    const today = new Date();
    const daysDiff = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
    return daysDiff <= 3 && daysDiff >= 0;
  };

  const isOverdue = (deadline) => {
    const deadlineDate = new Date(deadline);
    const today = new Date();
    return deadlineDate < today;
  };

  // Handler for creating assignment from template row
  const handleTemplateAssignment = async (templateId, courseId, deadline) => {
    if (!courseId || !deadline) {
      showMessage('Please select course and deadline', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/create-from-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          courseId,
          templateId,
          deadline
        })
      });

      const data = await response.json();

      if (response.ok) {
        showMessage('Assignment created successfully!', 'success');
        await fetchAssignments();
      } else {
        showMessage(data.error || 'Failed to create assignment', 'error');
      }
    } catch (error) {
      console.error('Error creating assignment:', error);
      showMessage('Error creating assignment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderAssignments = () => {
    console.log('🎨 Rendering Assignments tab');
    console.log('📊 Current templates state:', templates);
    console.log('📊 Templates count:', templates.length);
    
    // Group templates by parent folder
    const groupedTemplates = {
      'Root Level': templates.filter(t => !t.parentFolder),
      'CIE/SEE Exams': templates.filter(t => t.parentFolder === 'CIE/SEE Exams'),
      'Remedial': templates.filter(t => t.parentFolder === 'Remedial'),
      'Custom': templates.filter(t => t.parentFolder && t.parentFolder !== 'CIE/SEE Exams' && t.parentFolder !== 'Remedial')
    };

    console.log('📁 Grouped templates:', groupedTemplates);

    return (
      <div className="roles-content">
        <h2>📋 Create Assignments from Templates</h2>
        
        {message.text && (
          <div className={`roles-message ${message.type}`}>
            {message.text}
          </div>
        )}

        {courses.length === 0 ? (
          <div className="no-data-message" style={{
            background: '#223b47',
            padding: '2rem',
            borderRadius: '12px',
            textAlign: 'center',
            border: '2px dashed #D5AB5D'
          }}>
            <h3 style={{ color: '#D5AB5D', marginBottom: '1rem' }}>No Courses Available</h3>
            <p style={{ color: '#ccc' }}>Create a course first in the "Create Courses" tab to begin assigning templates.</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="no-data-message" style={{
            background: '#223b47',
            padding: '2rem',
            borderRadius: '12px',
            textAlign: 'center',
            border: '2px dashed #D5AB5D'
          }}>
            <h3 style={{ color: '#D5AB5D', marginBottom: '1rem' }}>No Templates Available</h3>
            <p style={{ color: '#ccc' }}>Templates need to be seeded. Run: node seed-templates.js</p>
          </div>
        ) : (
          <div className="templates-assignment-container">
            {Object.entries(groupedTemplates).map(([folderName, folderTemplates]) => {
              if (folderTemplates.length === 0) return null;
              
              return (
                <div key={folderName} className="template-folder-section" style={{ marginBottom: '2rem' }}>
                  <h3 style={{
                    color: '#D5AB5D',
                    fontSize: '1.3rem',
                    marginBottom: '1rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '2px solid #D5AB5D'
                  }}>
                    📁 {folderName}
                  </h3>
                  
                  <div className="template-rows">
                    {folderTemplates
                      .sort((a, b) => a.order - b.order)
                      .map((template) => (
                        <TemplateAssignmentRow
                          key={template._id}
                          template={template}
                          courses={courses}
                          onAssign={handleTemplateAssignment}
                          loading={loading}
                        />
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // New component for individual template row
  const TemplateAssignmentRow = ({ template, courses, onAssign, loading }) => {
    const [selectedCourse, setSelectedCourse] = useState('');
    const [deadline, setDeadline] = useState('');

    const handleSubmit = (e) => {
      e.preventDefault();
      onAssign(template._id, selectedCourse, deadline);
    };

    return (
      <form 
        onSubmit={handleSubmit}
        className="template-assignment-row"
        style={{
          background: '#223b47',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '0.75rem',
          border: '1px solid rgba(213, 171, 93, 0.3)',
          display: 'grid',
          gridTemplateColumns: '2fr 2fr 1.5fr auto',
          gap: '1rem',
          alignItems: 'center'
        }}
      >
        {/* Template Name */}
        <div style={{ color: '#fff' }}>
          <strong style={{ color: '#D5AB5D', fontSize: '0.9rem' }}>
            {template.order.toString().padStart(2, '0')}. 
          </strong> {template.templateName}
          {template.description && (
            <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '4px' }}>
              {template.description}
            </div>
          )}
        </div>

        {/* Course Selection */}
        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          required
          style={{
            background: '#182E37',
            color: '#fff',
            border: '1px solid #D5AB5D',
            borderRadius: '4px',
            padding: '0.5rem',
            fontSize: '0.9rem'
          }}
        >
          <option value="">Select Course...</option>
          {courses.map(course => (
            <option key={course._id} value={course._id}>
              {course.courseCode} - {course.courseName}
            </option>
          ))}
        </select>

        {/* Deadline */}
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          required
          min={new Date().toISOString().split('T')[0]}
          style={{
            background: '#182E37',
            color: '#fff',
            border: '1px solid #D5AB5D',
            borderRadius: '4px',
            padding: '0.5rem',
            fontSize: '0.9rem'
          }}
        />

        {/* Create Button */}
        <button
          type="submit"
          disabled={loading}
          style={{
            background: '#D5AB5D',
            color: '#182E37',
            border: 'none',
            borderRadius: '6px',
            padding: '0.5rem 1.25rem',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            whiteSpace: 'nowrap'
          }}
        >
          {loading ? '...' : 'Create'}
        </button>
      </form>
    );
  };

  const renderRecords = () => {
    // Group assignments by course
    const assignmentsByCourse = assignments.reduce((acc, assignment) => {
      const courseCode = assignment.courseRef?.courseCode || assignment.courseCode || 'Unknown';
      if (!acc[courseCode]) {
        acc[courseCode] = {
          courseName: assignment.courseRef?.courseName || assignment.courseName || 'Unknown Course',
          assignments: []
        };
      }
      acc[courseCode].assignments.push(assignment);
      return acc;
    }, {});

    // Calculate statistics for each course
    const courseStats = Object.entries(assignmentsByCourse).map(([courseCode, data]) => {
      const total = data.assignments.length;
      const assigned = data.assignments.filter(a => a.status === 'assigned').length;
      const uploaded = data.assignments.filter(a => a.status === 'file-uploaded' || a.status === 'in-review').length;
      const reviewed = data.assignments.filter(a => a.status === 'approved-by-reviewer' || a.status === 'partially-approved').length;
      const completed = data.assignments.filter(a => a.status === 'approved-by-admin' || a.status === 'completed').length;
      const overdue = data.assignments.filter(a => isOverdue(a.deadline)).length;

      return {
        courseCode,
        courseName: data.courseName,
        total,
        assigned,
        uploaded,
        reviewed,
        completed,
        overdue,
        progress: total > 0 ? Math.round((completed / total) * 100) : 0
      };
    });

    return (
      <div className="roles-content">
        <h2>📊 Assignment Records - Visual Dashboard</h2>
        
        {assignments.length === 0 ? (
          <div className="roles-message">No assignments found</div>
        ) : (
          <>
            {/* Overall Statistics */}
            <div className="records-stats-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '32px'
            }}>
              <div className="stat-card" style={{
                background: '#223b47',
                padding: '20px',
                borderRadius: '12px',
                border: '2px solid #D5AB5D',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '32px', color: '#D5AB5D', fontWeight: 'bold' }}>
                  {assignments.length}
                </div>
                <div style={{ color: '#fff', marginTop: '8px' }}>Total Assignments</div>
              </div>
              <div className="stat-card" style={{
                background: '#223b47',
                padding: '20px',
                borderRadius: '12px',
                border: '2px solid #28a745',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '32px', color: '#28a745', fontWeight: 'bold' }}>
                  {assignments.filter(a => a.status === 'approved-by-admin' || a.status === 'completed').length}
                </div>
                <div style={{ color: '#fff', marginTop: '8px' }}>Completed</div>
              </div>
              <div className="stat-card" style={{
                background: '#223b47',
                padding: '20px',
                borderRadius: '12px',
                border: '2px solid #ffc107',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '32px', color: '#ffc107', fontWeight: 'bold' }}>
                  {assignments.filter(a => a.status === 'file-uploaded' || a.status === 'in-review' || a.status === 'approved-by-reviewer').length}
                </div>
                <div style={{ color: '#fff', marginTop: '8px' }}>In Progress</div>
              </div>
              <div className="stat-card" style={{
                background: '#223b47',
                padding: '20px',
                borderRadius: '12px',
                border: '2px solid #dc3545',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '32px', color: '#dc3545', fontWeight: 'bold' }}>
                  {assignments.filter(a => isOverdue(a.deadline)).length}
                </div>
                <div style={{ color: '#fff', marginTop: '8px' }}>Overdue</div>
              </div>
            </div>

            {/* SVG Circle Clock Visualizations per Course */}
            <h3 style={{ color: '#D5AB5D', marginBottom: '24px' }}>📚 Course Progress Tracker</h3>
            <div className="course-progress-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '24px',
              marginBottom: '32px'
            }}>
              {courseStats.map((course) => {
                const radius = 80;
                const circumference = 2 * Math.PI * radius;
                const progressOffset = circumference - (course.progress / 100) * circumference;

                return (
                  <div key={course.courseCode} className="course-progress-card" style={{
                    background: '#223b47',
                    padding: '24px',
                    borderRadius: '12px',
                    border: '2px solid #D5AB5D',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}>
                    <h4 style={{ color: '#D5AB5D', marginBottom: '8px' }}>{course.courseCode}</h4>
                    <p style={{ color: '#ccc', fontSize: '14px', marginBottom: '20px', textAlign: 'center' }}>
                      {course.courseName}
                    </p>

                    {/* SVG Circle Progress */}
                    <svg width="200" height="200" style={{ marginBottom: '20px' }}>
                      {/* Background circle */}
                      <circle
                        cx="100"
                        cy="100"
                        r={radius}
                        fill="none"
                        stroke="#182E37"
                        strokeWidth="12"
                      />
                      
                      {/* Progress circle */}
                      <circle
                        cx="100"
                        cy="100"
                        r={radius}
                        fill="none"
                        stroke="#D5AB5D"
                        strokeWidth="12"
                        strokeDasharray={circumference}
                        strokeDashoffset={progressOffset}
                        transform="rotate(-90 100 100)"
                        style={{
                          transition: 'stroke-dashoffset 0.5s ease'
                        }}
                      />
                      
                      {/* Center text */}
                      <text
                        x="100"
                        y="95"
                        textAnchor="middle"
                        fill="#D5AB5D"
                        fontSize="36"
                        fontWeight="bold"
                      >
                        {course.progress}%
                      </text>
                      <text
                        x="100"
                        y="115"
                        textAnchor="middle"
                        fill="#fff"
                        fontSize="12"
                      >
                        Complete
                      </text>

                      {/* Status arms/rays */}
                      {course.total > 0 && (
                        <>
                          {/* Assigned (top) */}
                          <line
                            x1="100"
                            y1="20"
                            x2="100"
                            y2="5"
                            stroke={course.assigned > 0 ? '#6c757d' : '#333'}
                            strokeWidth="3"
                            strokeLinecap="round"
                          />
                          
                          {/* Uploaded (right) */}
                          <line
                            x1="180"
                            y1="100"
                            x2="195"
                            y2="100"
                            stroke={course.uploaded > 0 ? '#007bff' : '#333'}
                            strokeWidth="3"
                            strokeLinecap="round"
                          />
                          
                          {/* Reviewed (bottom) */}
                          <line
                            x1="100"
                            y1="180"
                            x2="100"
                            y2="195"
                            stroke={course.reviewed > 0 ? '#ffc107' : '#333'}
                            strokeWidth="3"
                            strokeLinecap="round"
                          />
                          
                          {/* Completed (left) */}
                          <line
                            x1="20"
                            y1="100"
                            x2="5"
                            y2="100"
                            stroke={course.completed > 0 ? '#28a745' : '#333'}
                            strokeWidth="3"
                            strokeLinecap="round"
                          />
                        </>
                      )}
                    </svg>

                    {/* Status breakdown */}
                    <div style={{ width: '100%', fontSize: '13px', color: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span>✋ Assigned:</span>
                        <span style={{ color: '#6c757d', fontWeight: 'bold' }}>{course.assigned}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span>📤 Uploaded:</span>
                        <span style={{ color: '#007bff', fontWeight: 'bold' }}>{course.uploaded}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span>👁️ Reviewed:</span>
                        <span style={{ color: '#ffc107', fontWeight: 'bold' }}>{course.reviewed}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span>✅ Completed:</span>
                        <span style={{ color: '#28a745', fontWeight: 'bold' }}>{course.completed}</span>
                      </div>
                      {course.overdue > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #D5AB5D' }}>
                          <span>⚠️ Overdue:</span>
                          <span style={{ color: '#dc3545', fontWeight: 'bold' }}>{course.overdue}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detailed Table (collapsible) */}
            <details style={{ marginTop: '32px' }}>
              <summary style={{
                cursor: 'pointer',
                padding: '16px',
                background: '#223b47',
                border: '2px solid #D5AB5D',
                borderRadius: '8px',
                color: '#D5AB5D',
                fontWeight: 'bold',
                fontSize: '16px'
              }}>
                📋 View Detailed Assignment Table
              </summary>
              <div className="records-table-container" style={{ marginTop: '16px' }}>
                <table className="records-table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Template</th>
                      <th>Initiator</th>
                      <th>Reviewer</th>
                      <th>Status</th>
                      <th>Deadline</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((assignment) => (
                      <tr key={assignment._id}>
                        <td>
                          <div>
                            <strong>{assignment.courseRef?.courseCode || assignment.courseCode}</strong>
                            <br />
                            <small>{assignment.courseRef?.courseName || assignment.courseName}</small>
                          </div>
                        </td>
                        <td>{assignment.title || assignment.assignmentType}</td>
                        <td>
                          {(() => {
                            const initiators = assignment.assignedToInitiators || 
                                              (assignment.assignedToInitiator ? [assignment.assignedToInitiator] : []);
                            if (initiators.length === 0) return 'Not assigned';
                            if (initiators.length === 1) {
                              return `${initiators[0].firstName} ${initiators[0].lastName}`;
                            }
                            return `${initiators.length} initiators`;
                          })()}
                        </td>
                        <td>
                          {(() => {
                            const reviewers = assignment.assignedToReviewers || 
                                             (assignment.assignedToReviewer ? [assignment.assignedToReviewer] : []);
                            if (reviewers.length === 0) return 'Not assigned';
                            if (reviewers.length === 1) {
                              return `${reviewers[0].firstName} ${reviewers[0].lastName}`;
                            }
                            return `${reviewers.length} reviewers`;
                          })()}
                        </td>
                        <td>
                          <span 
                            className="status-badge" 
                            style={{ backgroundColor: getStatusColor(assignment.status) }}
                          >
                            {assignment.status.replace(/-/g, ' ').toUpperCase()}
                          </span>
                        </td>
                        <td style={{
                          color: isOverdue(assignment.deadline) ? '#dc3545' : 
                                 isDeadlineNear(assignment.deadline) ? '#ffc107' : '#fff'
                        }}>
                          {formatDate(assignment.deadline)}
                          {isOverdue(assignment.deadline) && <><br /><small>OVERDUE</small></>}
                        </td>
                        <td>
                          <button 
                            className="edit-btn"
                            onClick={() => handleEditAssignment(assignment)}
                            title="Edit Assignment"
                          >
                            ✏️ Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </div>
    );
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          username: userForm.username,
          email: userForm.email,
          password: userForm.password,
          role: userForm.role,
          school: userForm.school
        })
      });

      const data = await response.json();

      if (response.ok) {
        showMessage('User created successfully', 'success');
        setUserForm({
          username: '',
          email: '',
          password: '',
          role: 'user',
          school: ''
        });
        await fetchUsers();
      } else {
        showMessage(data.error || 'Failed to create user', 'error');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      showMessage('Error creating user', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderCreateUsers = () => (
    <div className="roles-content">
      <h2>Create New User</h2>
      
      <form onSubmit={handleCreateUser} className="roles-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="username">Username *</label>
            <input
              type="text"
              id="username"
              value={userForm.username}
              onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
              required
              placeholder="Enter username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              required
              placeholder="Enter email"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <input
              type="password"
              id="password"
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              required
              placeholder="Enter password"
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label htmlFor="school">School/Department</label>
            <input
              type="text"
              id="school"
              value={userForm.school}
              onChange={(e) => setUserForm({ ...userForm, school: e.target.value })}
              placeholder="e.g., SoCSE, School of Management"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="role">Role *</label>
            <select
              id="role"
              value={userForm.role}
              onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
              required
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        <button 
          type="submit" 
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create User'}
        </button>
      </form>

      <div className="form-note">
        <p><strong>Note:</strong> Course assignments can be managed through "Create Courses" or "Manage Courses" tabs.</p>
      </div>
    </div>
  );

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/assignment-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(templateForm)
      });

      const data = await response.json();

      if (response.ok) {
        showMessage('Template created successfully', 'success');
        setTemplateForm({
          templateName: '',
          category: '',
          description: '',
          parentFolder: ''
        });
        await fetchTemplates();
        // Refresh custom templates list
        const customTemps = templates.filter(t => !t.isPredefined);
        setCustomTemplates(customTemps);
      } else {
        showMessage(data.error || 'Failed to create template', 'error');
      }
    } catch (error) {
      console.error('Error creating template:', error);
      showMessage('Error creating template', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/assignment-templates/${templateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      if (response.ok) {
        showMessage('Template deleted successfully', 'success');
        await fetchTemplates();
        const customTemps = templates.filter(t => !t.isPredefined && t._id !== templateId);
        setCustomTemplates(customTemps);
      } else {
        showMessage('Failed to delete template', 'error');
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      showMessage('Error deleting template', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBannerUpload = async (e) => {
    e.preventDefault();
    if (!bannerFile) {
      showMessage('Please select a file', 'error');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('banner', bannerFile);

    try {
      const response = await fetch(`${API_BASE_URL}/api/banners/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        showMessage('Banner uploaded successfully', 'success');
        setBannerFile(null);
        // Reset file input
        document.getElementById('bannerFile').value = '';
        // Refresh banners list
        await fetchBanners();
      } else {
        showMessage(data.error || 'Failed to upload banner', 'error');
      }
    } catch (error) {
      console.error('Error uploading banner:', error);
      showMessage('Error uploading banner', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBanner = async (bannerId) => {
    if (!confirm('Are you sure you want to delete this banner?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/banners/${bannerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      if (response.ok) {
        showMessage('Banner deleted successfully', 'success');
        await fetchBanners();
      } else {
        showMessage('Failed to delete banner', 'error');
      }
    } catch (error) {
      console.error('Error deleting banner:', error);
      showMessage('Error deleting banner', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderOthers = () => (
    <div className="roles-content">
      <h2>Other Administrative Tools</h2>

      {/* Custom Template Creation */}
      <div className="others-section">
        <h3>Create Custom Template</h3>
        <form onSubmit={handleCreateTemplate} className="roles-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="templateName">Template Name *</label>
              <input
                type="text"
                id="templateName"
                value={templateForm.templateName}
                onChange={(e) => setTemplateForm({ ...templateForm, templateName: e.target.value })}
                required
                placeholder="e.g., Special Assessment Report"
              />
            </div>

            <div className="form-group">
              <label htmlFor="category">Category *</label>
              <input
                type="text"
                id="category"
                value={templateForm.category}
                onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                required
                placeholder="e.g., Custom, Special"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="parentFolder">Parent Folder</label>
              <select
                id="parentFolder"
                value={templateForm.parentFolder}
                onChange={(e) => setTemplateForm({ ...templateForm, parentFolder: e.target.value })}
              >
                <option value="">Root Level</option>
                <option value="CIE/SEE Exams and Marks">CIE/SEE Exams and Marks</option>
                <option value="Remedial">Remedial</option>
                <option value="Custom">Custom</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <input
                type="text"
                id="description"
                value={templateForm.description}
                onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                placeholder="Brief description of the template"
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Template'}
          </button>
        </form>

        {/* Custom Templates List */}
        {customTemplates.length > 0 && (
          <div className="custom-templates-list">
            <h4>Custom Templates</h4>
            <table className="users-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Folder</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customTemplates.map((template) => (
                  <tr key={template._id}>
                    <td>{template.templateName}</td>
                    <td>{template.category}</td>
                    <td>{template.parentFolder || 'Root'}</td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteTemplate(template._id)}
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Banner Upload Section */}
      <div className="others-section" style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #ddd' }}>
        <h3>Binary Banner Management</h3>
        <p className="form-note">Upload banner PDFs for dashboard display</p>
        
        <form onSubmit={handleBannerUpload} className="roles-form">
          <div className="form-group">
            <label htmlFor="bannerFile">Select Banner PDF *</label>
            <input
              type="file"
              id="bannerFile"
              accept=".pdf"
              onChange={(e) => setBannerFile(e.target.files[0])}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading || !bannerFile}
          >
            {loading ? 'Uploading...' : 'Upload Banner'}
          </button>
        </form>

        {banners.length > 0 && (
          <div className="banners-list" style={{ marginTop: '2rem' }}>
            <h4>Uploaded Banners</h4>
            <table className="users-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Upload Date</th>
                  <th>Size</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {banners.map((banner) => (
                  <tr key={banner._id}>
                    <td>{banner.originalName || banner.filename}</td>
                    <td>{new Date(banner.uploadDate).toLocaleDateString()}</td>
                    <td>{(banner.length / 1024).toFixed(2)} KB</td>
                    <td>
                      <a
                        href={`${API_BASE_URL}/api/banners/${banner._id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm"
                        style={{ marginRight: '8px', background: '#D5AB5D', color: '#182E37' }}
                      >
                        View
                      </a>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteBanner(banner._id)}
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderUserRoles = () => (
    <div className="roles-content">
      <h2>User Role Management</h2>
      
      {users.length === 0 ? (
        <div className="roles-message">No users found</div>
      ) : (
        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Subrole</th>
                <th>Course Code</th>
                <th>Course Name</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(users || []).map((user) => (
                <tr key={user._id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <select
                      value={user.role}
                      onChange={(e) => handleUserRoleUpdate(user._id, 'role', e.target.value)}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    <select
                      value={user.subrole || 'none'}
                      onChange={(e) => handleUserRoleUpdate(user._id, 'subrole', e.target.value)}
                    >
                      <option value="none">None</option>
                      <option value="initiator">Initiator</option>
                      <option value="reviewer">Reviewer</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={user.courseCode || ''}
                      onChange={(e) => handleUserRoleUpdate(user._id, 'courseCode', e.target.value)}
                      placeholder="Course Code"
                      style={{ width: '100px' }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={user.courseName || ''}
                      onChange={(e) => handleUserRoleUpdate(user._id, 'courseName', e.target.value)}
                      placeholder="Course Name"
                      style={{ width: '150px' }}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => showMessage('User updated successfully!', 'success')}
                      style={{ 
                        padding: '5px 10px', 
                        fontSize: '12px',
                        backgroundColor: '#D5AB5D',
                        border: 'none',
                        borderRadius: '4px',
                        color: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      Update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderUserCreate = () => (
    <div className="roles-content">
      <h2>Create New User</h2>
      
      {message.text && (
        <div className={`roles-message ${message.type}`}>
          {message.text}
        </div>
      )}

      <form className="assignment-form" onSubmit={handleUserCreate}>
        <div className="form-row">
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={userForm.username}
              onChange={(e) => setUserForm({...userForm, username: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={userForm.email}
              onChange={(e) => setUserForm({...userForm, email: e.target.value})}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={userForm.password}
              onChange={(e) => setUserForm({...userForm, password: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select
              value={userForm.role}
              onChange={(e) => setUserForm({...userForm, role: e.target.value})}
              required
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <small style={{color: '#D5AB5D', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block'}}>
              Note: Viewers are for non-logged in website visitors and cannot be assigned tasks
            </small>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>First Name</label>
            <input
              type="text"
              value={userForm.firstName}
              onChange={(e) => setUserForm({...userForm, firstName: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label>Last Name</label>
            <input
              type="text"
              value={userForm.lastName}
              onChange={(e) => setUserForm({...userForm, lastName: e.target.value})}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Course Code *</label>
            <select
              value={userForm.courseCode}
              onChange={handleCourseCodeChange}
              required
            >
              <option value="">Select Course Code</option>
              {getAllCourses().map(course => (
                <option key={course.code} value={course.code}>
                  {course.code}
                </option>
              ))}
            </select>
            <small className="form-help">Select the course code for the user</small>
          </div>
          <div className="form-group">
            <label>Course Name</label>
            <input
              type="text"
              value={userForm.courseName}
              onChange={handleCourseNameChange}
              placeholder="Enter course name"
            />
            <small className="form-help">Auto-filled from course code selection</small>
          </div>
        </div>

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Creating User...' : 'Create User'}
        </button>
      </form>
    </div>
  );

  // Render Create Courses Tab
  const renderCreateCourses = () => {
    const handleCourseSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
      
      try {
        // Build courseMembers array from selected initiators and reviewers
        const courseMembers = [
          ...courseForm.selectedInitiators.map(userId => ({
            userId,
            role: 'initiator'
          })),
          ...courseForm.selectedReviewers.map(userId => ({
            userId,
            role: 'reviewer'
          }))
        ];

        const response = await fetch(`${API_BASE_URL}/api/courses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
          },
          body: JSON.stringify({
            ...courseForm,
            courseMembers
          })
        });

        if (response.ok) {
          const data = await response.json();
          setCourses([...courses, data.course]);
          setCourseForm({
            courseCode: '',
            courseName: '',
            year: new Date().getFullYear().toString(),
            semester: 1,
            school: 'SoCSE',
            programme: 'BTech',
            credits: 4,
            selectedInitiators: [],
            selectedReviewers: []
          });
          showMessage('Course created successfully!', 'success');
        } else {
          const errorData = await response.json();
          showMessage(errorData.error || 'Failed to create course', 'error');
        }
      } catch (error) {
        console.error('Error creating course:', error);
        showMessage('Error creating course', 'error');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="roles-content">
        <h2>Create New Course</h2>
        <form onSubmit={handleCourseSubmit} className="user-form">
          <div className="form-row">
            <div className="form-group">
              <label>Course Code *</label>
              <input
                type="text"
                value={courseForm.courseCode}
                onChange={(e) => setCourseForm({...courseForm, courseCode: e.target.value})}
                placeholder="e.g., CS101"
                pattern="^[A-Z]{2,4}\\d{3}$"
                title="Format: 2-4 uppercase letters followed by 3 digits"
                required
              />
              <small className="form-help">Format: 2-4 letters + 3 digits (e.g., CS101)</small>
            </div>

            <div className="form-group">
              <label>Course Name *</label>
              <input
                type="text"
                value={courseForm.courseName}
                onChange={(e) => setCourseForm({...courseForm, courseName: e.target.value})}
                placeholder="e.g., Data Structures and Algorithms"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Year *</label>
              <input
                type="text"
                value={courseForm.year}
                onChange={(e) => setCourseForm({...courseForm, year: e.target.value})}
                placeholder="2024"
                pattern="^\\d{4}$"
                title="4-digit year"
                required
              />
            </div>

            <div className="form-group">
              <label>Semester *</label>
              <select
                value={courseForm.semester}
                onChange={(e) => setCourseForm({...courseForm, semester: parseInt(e.target.value)})}
                required
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                  <option key={sem} value={sem}>Semester {sem}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Credits *</label>
              <input
                type="number"
                value={courseForm.credits}
                onChange={(e) => setCourseForm({...courseForm, credits: parseInt(e.target.value)})}
                min="1"
                max="10"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>School *</label>
              <select
                value={courseForm.school}
                onChange={(e) => setCourseForm({...courseForm, school: e.target.value})}
                required
              >
                <option value="SoCSE">SoCSE</option>
                <option value="SoECE">SoECE</option>
                <option value="SoME">SoME</option>
                <option value="SoCE">SoCE</option>
                <option value="SoAS">SoAS</option>
              </select>
            </div>

            <div className="form-group">
              <label>Programme *</label>
              <select
                value={courseForm.programme}
                onChange={(e) => setCourseForm({...courseForm, programme: e.target.value})}
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

          {/* Initiators Selection */}
          <div className="form-group">
            <label>Assign Initiators</label>
            <select
              multiple
              value={courseForm.selectedInitiators}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                setCourseForm({...courseForm, selectedInitiators: selected});
              }}
              style={{ minHeight: '120px' }}
            >
              {users.filter(u => u.role === 'user').map(user => (
                <option key={user._id} value={user._id}>
                  {user.username} ({user.email})
                </option>
              ))}
            </select>
            <small className="form-help">Hold Ctrl/Cmd to select multiple initiators</small>
          </div>

          {/* Reviewers Selection */}
          <div className="form-group">
            <label>Assign Reviewers</label>
            <select
              multiple
              value={courseForm.selectedReviewers}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                setCourseForm({...courseForm, selectedReviewers: selected});
              }}
              style={{ minHeight: '120px' }}
            >
              {users.filter(u => u.role === 'user').map(user => (
                <option key={user._id} value={user._id}>
                  {user.username} ({user.email})
                </option>
              ))}
            </select>
            <small className="form-help">Hold Ctrl/Cmd to select multiple reviewers</small>
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Creating Course...' : 'Create Course'}
          </button>
        </form>
      </div>
    );
  };

  // Render Manage Courses Tab
  const renderManageCourses = () => {
    const handleDeleteCourse = async (courseId) => {
      if (!confirm('Are you sure you want to delete this course?')) {
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/courses/${courseId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${getToken()}`
          }
        });

        if (response.ok) {
          setCourses(courses.filter(c => c._id !== courseId));
          showMessage('Course deleted successfully!', 'success');
        } else {
          showMessage('Failed to delete course', 'error');
        }
      } catch (error) {
        console.error('Error deleting course:', error);
        showMessage('Error deleting course', 'error');
      }
    };

    return (
      <div className="roles-content">
        <h2>Manage Courses</h2>
        <div className="courses-table-wrapper">
          <table className="courses-table">
            <thead>
              <tr>
                <th>Course ID</th>
                <th>Code</th>
                <th>Name</th>
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
                  <td colSpan="9" style={{textAlign: 'center', padding: '2rem'}}>
                    No courses found. Create your first course!
                  </td>
                </tr>
              ) : (
                courses.map(course => (
                  <tr key={course._id}>
                    <td style={{fontFamily: 'monospace', color: '#D5AB5D'}}>{course.courseId}</td>
                    <td><strong>{course.courseCode}</strong></td>
                    <td>{course.courseName}</td>
                    <td>{course.school}</td>
                    <td>{course.programme}</td>
                    <td>Sem {course.semester}</td>
                    <td>{course.credits}</td>
                    <td>{course.courseMembers?.length || 0}</td>
                    <td>
                      <button 
                        className="action-btn delete-btn"
                        onClick={() => handleDeleteCourse(course._id)}
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
      </div>
    );
  };

  return (
    <div className="roles-container">
      <h1 className="roles-heading">Admin Role Management</h1>
      
      <div className="roles-tabs">
        <button 
          className={`roles-tab ${activeTab === 'assignments' ? 'active' : ''}`}
          onClick={() => setActiveTab('assignments')}
        >
          Assignments
        </button>
        <button 
          className={`roles-tab ${activeTab === 'records' ? 'active' : ''}`}
          onClick={() => setActiveTab('records')}
        >
          Records
        </button>
        <button 
          className={`roles-tab ${activeTab === 'create-courses' ? 'active' : ''}`}
          onClick={() => setActiveTab('create-courses')}
        >
          Create Courses
        </button>
        <button 
          className={`roles-tab ${activeTab === 'manage-courses' ? 'active' : ''}`}
          onClick={() => setActiveTab('manage-courses')}
        >
          Manage Courses
        </button>
        <button 
          className={`roles-tab ${activeTab === 'create-users' ? 'active' : ''}`}
          onClick={() => setActiveTab('create-users')}
        >
          Create Users
        </button>
        <button 
          className={`roles-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Manage Users
        </button>
        <button 
          className={`roles-tab ${activeTab === 'others' ? 'active' : ''}`}
          onClick={() => setActiveTab('others')}
        >
          Others
        </button>
      </div>

      {activeTab === 'assignments' && Array.isArray(users) && renderAssignments()}
      {activeTab === 'assignments' && !Array.isArray(users) && (
        <div className="roles-content">
          <h2>Loading...</h2>
          <p>Loading user data...</p>
        </div>
      )}
      {activeTab === 'records' && renderRecords()}
      {activeTab === 'create-courses' && renderCreateCourses()}
      {activeTab === 'manage-courses' && renderManageCourses()}
      {activeTab === 'create-users' && renderCreateUsers()}
      {activeTab === 'users' && Array.isArray(users) && renderUserRoles()}
      {activeTab === 'users' && !Array.isArray(users) && (
        <div className="roles-content">
          <h2>Loading...</h2>
          <p>Loading user data...</p>
        </div>
      )}
      {activeTab === 'others' && renderOthers()}

      {/* Assignment Edit Modal */}
      {showEditModal && editingAssignment && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Assignment</h3>
              <button 
                className="modal-close"
                onClick={() => setShowEditModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Course Code:</label>
                <input
                  type="text"
                  value={editingAssignment.courseCode}
                  onChange={(e) => setEditingAssignment({...editingAssignment, courseCode: e.target.value})}
                />
              </div>
              
              <div className="form-group">
                <label>Course Name:</label>
                <input
                  type="text"
                  value={editingAssignment.courseName}
                  onChange={(e) => setEditingAssignment({...editingAssignment, courseName: e.target.value})}
                />
              </div>
              
              <div className="form-group">
                <label>Initiator:</label>
                <select
                  value={editingAssignment.assignedToInitiator}
                  onChange={(e) => setEditingAssignment({...editingAssignment, assignedToInitiator: e.target.value})}
                >
                  <option value="">Select Initiator</option>
                  {(users || []).filter(user => user.role !== 'admin').map(user => (
                    <option key={user._id} value={user._id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Reviewer:</label>
                <select
                  value={editingAssignment.assignedToReviewer}
                  onChange={(e) => setEditingAssignment({...editingAssignment, assignedToReviewer: e.target.value})}
                >
                  <option value="">Select Reviewer</option>
                  {(users || []).filter(user => user.role !== 'admin').map(user => (
                    <option key={user._id} value={user._id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Deadline:</label>
                <input
                  type="date"
                  value={editingAssignment.deadline}
                  onChange={(e) => setEditingAssignment({...editingAssignment, deadline: e.target.value})}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleUpdateAssignment}
              >
                Update Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Roles;
