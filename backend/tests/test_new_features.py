"""
Spark Fit New Features Testing - Iteration 2
Testing: Attendance API, Password Change API, Booking History with Status
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://spark-elite.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "AdministracionGimnasio1@gmail.com"
ADMIN_PASSWORD = "AdministracionGimnasio1.2026"
CLIENT_EMAIL = "cliente@test.com"
CLIENT_PASSWORD = "cliente123"


class TestAuthentication:
    """Test login functionality for admin and client"""
    
    def test_admin_login_success(self):
        """Admin can log in successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == ADMIN_EMAIL
    
    def test_client_login_success(self):
        """Client can log in successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "client"
        assert data["user"]["email"] == CLIENT_EMAIL


@pytest.fixture
def admin_session():
    """Get admin session token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip("Admin authentication failed")
    token = response.json().get("token")
    session = requests.Session()
    session.cookies.set("session_token", token)
    return session


@pytest.fixture
def client_session():
    """Get client session token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": CLIENT_EMAIL,
        "password": CLIENT_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip("Client authentication failed")
    token = response.json().get("token")
    user_id = response.json()["user"]["user_id"]
    session = requests.Session()
    session.cookies.set("session_token", token)
    session.user_id = user_id
    return session


class TestAttendanceAPI:
    """Test admin attendance marking functionality"""
    
    def test_attendance_api_requires_auth(self):
        """Attendance API requires authentication"""
        response = requests.post(f"{BASE_URL}/api/admin/attendance", json={
            "booking_id": "test_id",
            "status": "attended"
        })
        assert response.status_code == 401
    
    def test_attendance_api_rejects_non_admin(self, client_session):
        """Attendance API rejects non-admin users"""
        response = client_session.post(f"{BASE_URL}/api/admin/attendance", json={
            "booking_id": "test_id",
            "status": "attended"
        })
        assert response.status_code == 403
    
    def test_attendance_api_validates_status(self, admin_session):
        """Attendance API validates status values"""
        response = admin_session.post(f"{BASE_URL}/api/admin/attendance", json={
            "booking_id": "test_id",
            "status": "invalid_status"
        })
        assert response.status_code == 400
        assert "inválido" in response.json().get("detail", "").lower() or "invalid" in response.json().get("detail", "").lower()
    
    def test_attendance_api_validates_booking_exists(self, admin_session):
        """Attendance API validates booking exists"""
        response = admin_session.post(f"{BASE_URL}/api/admin/attendance", json={
            "booking_id": "nonexistent_booking",
            "status": "attended"
        })
        assert response.status_code == 404
    
    def test_attendance_api_accepts_attended_status(self, admin_session):
        """Attendance API accepts 'attended' status for confirmed bookings"""
        # Get bookings first to find a confirmed one
        bookings_response = admin_session.get(f"{BASE_URL}/api/admin/bookings")
        bookings = bookings_response.json()
        
        confirmed_booking = None
        for b in bookings:
            if b.get("status") == "confirmed":
                confirmed_booking = b
                break
        
        if not confirmed_booking:
            pytest.skip("No confirmed booking found to test attendance")
        
        response = admin_session.post(f"{BASE_URL}/api/admin/attendance", json={
            "booking_id": confirmed_booking["booking_id"],
            "status": "attended"
        })
        assert response.status_code == 200
        assert "message" in response.json()
    
    def test_attendance_api_accepts_absent_status(self, admin_session):
        """Attendance API accepts 'absent' status for confirmed bookings"""
        # Get bookings first to find a confirmed one
        bookings_response = admin_session.get(f"{BASE_URL}/api/admin/bookings")
        bookings = bookings_response.json()
        
        confirmed_booking = None
        for b in bookings:
            if b.get("status") == "confirmed":
                confirmed_booking = b
                break
        
        if not confirmed_booking:
            pytest.skip("No confirmed booking found to test attendance")
        
        response = admin_session.post(f"{BASE_URL}/api/admin/attendance", json={
            "booking_id": confirmed_booking["booking_id"],
            "status": "absent"
        })
        assert response.status_code == 200
        assert "message" in response.json()


class TestPasswordChangeAPI:
    """Test admin password change functionality"""
    
    def test_password_api_requires_auth(self):
        """Password change API requires authentication"""
        response = requests.post(f"{BASE_URL}/api/admin/change-password", json={
            "user_id": "test_id",
            "new_password": "newpassword123"
        })
        assert response.status_code == 401
    
    def test_password_api_rejects_non_admin(self, client_session):
        """Password change API rejects non-admin users"""
        response = client_session.post(f"{BASE_URL}/api/admin/change-password", json={
            "user_id": "test_id",
            "new_password": "newpassword123"
        })
        assert response.status_code == 403
    
    def test_password_api_validates_user_exists(self, admin_session):
        """Password change API validates user exists"""
        response = admin_session.post(f"{BASE_URL}/api/admin/change-password", json={
            "user_id": "nonexistent_user",
            "new_password": "newpassword123"
        })
        assert response.status_code == 404
    
    def test_password_api_validates_minimum_length(self, admin_session):
        """Password change API validates minimum password length"""
        # Get a valid user ID first
        users_response = admin_session.get(f"{BASE_URL}/api/admin/users")
        users = users_response.json()
        client_user = None
        for u in users:
            if u.get("role") == "client":
                client_user = u
                break
        
        if not client_user:
            pytest.skip("No client user found")
        
        response = admin_session.post(f"{BASE_URL}/api/admin/change-password", json={
            "user_id": client_user["user_id"],
            "new_password": "123"
        })
        assert response.status_code == 400
        assert "6" in response.json().get("detail", "") or "caracteres" in response.json().get("detail", "")
    
    def test_password_change_works(self, admin_session):
        """Password change actually changes the password"""
        # Get the test client user
        users_response = admin_session.get(f"{BASE_URL}/api/admin/users")
        users = users_response.json()
        
        test_user = None
        for u in users:
            if u.get("email") == CLIENT_EMAIL:
                test_user = u
                break
        
        if not test_user:
            pytest.skip("Test client user not found")
        
        # Change password to test password
        test_password = "test_temp_password_123"
        response = admin_session.post(f"{BASE_URL}/api/admin/change-password", json={
            "user_id": test_user["user_id"],
            "new_password": test_password
        })
        assert response.status_code == 200
        
        # Verify user can login with new password
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": test_password
        })
        assert login_response.status_code == 200
        
        # Reset password back to original
        reset_response = admin_session.post(f"{BASE_URL}/api/admin/change-password", json={
            "user_id": test_user["user_id"],
            "new_password": CLIENT_PASSWORD
        })
        assert reset_response.status_code == 200


class TestBookingHistory:
    """Test client booking history with status labels"""
    
    def test_client_can_get_bookings(self, client_session):
        """Client can retrieve their booking history"""
        response = client_session.get(f"{BASE_URL}/api/bookings/my")
        assert response.status_code == 200
        bookings = response.json()
        assert isinstance(bookings, list)
    
    def test_bookings_have_status_field(self, client_session):
        """Bookings include status field"""
        response = client_session.get(f"{BASE_URL}/api/bookings/my")
        assert response.status_code == 200
        bookings = response.json()
        
        if not bookings:
            pytest.skip("No bookings found for client")
        
        for booking in bookings:
            assert "status" in booking
            # Status should be one of: confirmed, cancelled, attended, absent
            assert booking["status"] in ["confirmed", "cancelled", "attended", "absent"]
    
    def test_bookings_have_required_fields(self, client_session):
        """Bookings have all required fields"""
        response = client_session.get(f"{BASE_URL}/api/bookings/my")
        assert response.status_code == 200
        bookings = response.json()
        
        if not bookings:
            pytest.skip("No bookings found for client")
        
        required_fields = ["booking_id", "date", "time", "activity_type", "status"]
        for booking in bookings:
            for field in required_fields:
                assert field in booking, f"Missing field: {field}"


class TestAdminEndpoints:
    """Test admin-specific endpoints"""
    
    def test_admin_get_users(self, admin_session):
        """Admin can get all users"""
        response = admin_session.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        assert len(users) > 0
        
        # Each user should have required fields
        for user in users:
            assert "user_id" in user
            assert "email" in user
            assert "name" in user
            assert "role" in user
    
    def test_admin_get_bookings(self, admin_session):
        """Admin can get all bookings"""
        response = admin_session.get(f"{BASE_URL}/api/admin/bookings")
        assert response.status_code == 200
        bookings = response.json()
        assert isinstance(bookings, list)
        
        # Bookings should include user info
        for booking in bookings:
            if booking.get("user"):
                assert "name" in booking["user"]
                assert "email" in booking["user"]


class TestAPIRoot:
    """Basic API health checks"""
    
    def test_api_root_returns_message(self):
        """API root endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
