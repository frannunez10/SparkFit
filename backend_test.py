#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime, timedelta
from typing import Dict, Any

class SparkFitAPITester:
    def __init__(self):
        self.base_url = "https://spark-elite.preview.emergentagent.com/api"
        self.session = requests.Session()
        self.admin_token = None
        self.client_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name: str, passed: bool, details: str = "", response_data: Any = None):
        """Log test results"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "name": name,
            "passed": passed,
            "details": details,
            "response_data": response_data
        })

    def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None, use_token: str = None) -> requests.Response:
        """Make HTTP request with proper error handling and authentication"""
        url = f"{self.base_url}/{endpoint}"
        
        if headers is None:
            headers = {"Content-Type": "application/json"}
        
        # Use token as cookie (which is how the server expects it)
        if use_token:
            self.session.cookies.set('session_token', use_token, domain='spark-elite.preview.emergentagent.com', path='/')
        
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=headers)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=headers)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response
        except Exception as e:
            print(f"Request error for {method} {url}: {str(e)}")
            raise

    def test_root_endpoint(self):
        """Test root API endpoint"""
        try:
            response = self.make_request("GET", "")
            if response.status_code == 200 and "Spark Fit API" in response.text:
                self.log_test("Root endpoint", True, "API is accessible")
                return True
            else:
                self.log_test("Root endpoint", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Root endpoint", False, f"Error: {str(e)}")
            return False

    def test_admin_login(self):
        """Test admin authentication"""
        try:
            # Test with admin1@sparkfit.com
            login_data = {
                "email": "admin1@sparkfit.com",
                "password": "admin123"
            }
            
            response = self.make_request("POST", "auth/login", login_data)
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    self.admin_token = data["token"]
                    user = data["user"]
                    if user.get("role") == "admin":
                        self.log_test("Admin login", True, f"Admin {user.get('email')} authenticated successfully")
                        return True
                    else:
                        self.log_test("Admin login", False, f"User role is {user.get('role')}, expected admin")
                        return False
                else:
                    self.log_test("Admin login", False, "Missing token or user in response")
                    return False
            else:
                self.log_test("Admin login", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Admin login", False, f"Error: {str(e)}")
            return False

    def test_client_login(self):
        """Test client authentication"""
        try:
            login_data = {
                "email": "cliente@test.com",
                "password": "cliente123"
            }
            
            response = self.make_request("POST", "auth/login", login_data)
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    self.client_token = data["token"]
                    user = data["user"]
                    if user.get("role") == "client":
                        self.log_test("Client login", True, f"Client {user.get('email')} authenticated, credits: {user.get('credits', 0)}")
                        return True
                    else:
                        self.log_test("Client login", False, f"User role is {user.get('role')}, expected client")
                        return False
                else:
                    self.log_test("Client login", False, "Missing token or user in response")
                    return False
            else:
                self.log_test("Client login", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Client login", False, f"Error: {str(e)}")
            return False

    def test_auth_me_endpoint(self):
        """Test /auth/me endpoint for both admin and client"""
        # Test admin
        if self.admin_token:
            try:
                response = self.make_request("GET", "auth/me", use_token=self.admin_token)
                
                if response.status_code == 200:
                    user = response.json()
                    if user.get("role") == "admin":
                        self.log_test("Auth /me (admin)", True, f"Admin user data retrieved successfully")
                    else:
                        self.log_test("Auth /me (admin)", False, f"Wrong role: {user.get('role')}")
                else:
                    self.log_test("Auth /me (admin)", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_test("Auth /me (admin)", False, f"Error: {str(e)}")

        # Test client
        if self.client_token:
            try:
                response = self.make_request("GET", "auth/me", use_token=self.client_token)
                
                if response.status_code == 200:
                    user = response.json()
                    if user.get("role") == "client":
                        self.log_test("Auth /me (client)", True, f"Client user data retrieved successfully")
                    else:
                        self.log_test("Auth /me (client)", False, f"Wrong role: {user.get('role')}")
                else:
                    self.log_test("Auth /me (client)", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_test("Auth /me (client)", False, f"Error: {str(e)}")

    def test_admin_slots_crud(self):
        """Test admin slots CRUD operations"""
        if not self.admin_token:
            self.log_test("Admin Slots CRUD", False, "No admin token available")
            return

        created_slot_id = None

        try:
            # Test GET all slots
            response = self.make_request("GET", "admin/slots", use_token=self.admin_token)
            if response.status_code == 200:
                slots = response.json()
                self.log_test("Get all slots", True, f"Retrieved {len(slots)} slots")
            else:
                self.log_test("Get all slots", False, f"Status: {response.status_code}")

            # Test CREATE slot
            tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
            slot_data = {
                "activity_type": "entrenamiento",
                "date": tomorrow,
                "time": "10:00",
                "max_capacity": 5,
                "credits_cost": 1
            }
            
            response = self.make_request("POST", "admin/slots", slot_data, use_token=self.admin_token)
            if response.status_code == 200:
                slot = response.json()
                created_slot_id = slot.get("slot_id")
                self.log_test("Create slot", True, f"Slot created with ID: {created_slot_id}")
            else:
                self.log_test("Create slot", False, f"Status: {response.status_code}, Response: {response.text}")

            # Test DELETE slot
            if created_slot_id:
                response = self.make_request("DELETE", f"admin/slots/{created_slot_id}", use_token=self.admin_token)
                if response.status_code == 200:
                    self.log_test("Delete slot", True, "Slot deleted successfully")
                else:
                    self.log_test("Delete slot", False, f"Status: {response.status_code}")

        except Exception as e:
            self.log_test("Admin Slots CRUD", False, f"Error: {str(e)}")

    def test_admin_users_endpoint(self):
        """Test admin users endpoint"""
        if not self.admin_token:
            self.log_test("Admin Users", False, "No admin token available")
            return

        try:
            response = self.make_request("GET", "admin/users", use_token=self.admin_token)
            
            if response.status_code == 200:
                users = response.json()
                admin_count = sum(1 for user in users if user.get("role") == "admin")
                client_count = sum(1 for user in users if user.get("role") == "client")
                self.log_test("Get all users", True, f"Retrieved {len(users)} users ({admin_count} admins, {client_count} clients)")
            else:
                self.log_test("Get all users", False, f"Status: {response.status_code}")

        except Exception as e:
            self.log_test("Admin Users", False, f"Error: {str(e)}")

    def test_admin_bookings_endpoint(self):
        """Test admin bookings endpoint"""
        if not self.admin_token:
            self.log_test("Admin Bookings", False, "No admin token available")
            return

        try:
            response = self.make_request("GET", "admin/bookings", use_token=self.admin_token)
            
            if response.status_code == 200:
                bookings = response.json()
                confirmed_count = sum(1 for booking in bookings if booking.get("status") == "confirmed")
                cancelled_count = sum(1 for booking in bookings if booking.get("status") == "cancelled")
                self.log_test("Get all bookings", True, f"Retrieved {len(bookings)} bookings ({confirmed_count} confirmed, {cancelled_count} cancelled)")
            else:
                self.log_test("Get all bookings", False, f"Status: {response.status_code}")

        except Exception as e:
            self.log_test("Admin Bookings", False, f"Error: {str(e)}")

    def test_calendar_available(self):
        """Test calendar available slots endpoint"""
        if not self.client_token:
            self.log_test("Calendar Available", False, "No client token available")
            return

        try:
            # Test without filters
            response = self.make_request("GET", "calendar/available", use_token=self.client_token)
            if response.status_code == 200:
                slots = response.json()
                self.log_test("Get available slots (no filter)", True, f"Retrieved {len(slots)} available slots")
            else:
                self.log_test("Get available slots (no filter)", False, f"Status: {response.status_code}")

            # Test with date filter
            tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
            response = self.make_request("GET", f"calendar/available?date={tomorrow}", use_token=self.client_token)
            if response.status_code == 200:
                slots = response.json()
                self.log_test("Get available slots (date filter)", True, f"Retrieved {len(slots)} slots for {tomorrow}")
            else:
                self.log_test("Get available slots (date filter)", False, f"Status: {response.status_code}")

            # Test with activity filter
            response = self.make_request("GET", "calendar/available?activity_type=entrenamiento", use_token=self.client_token)
            if response.status_code == 200:
                slots = response.json()
                self.log_test("Get available slots (activity filter)", True, f"Retrieved {len(slots)} entrenamiento slots")
            else:
                self.log_test("Get available slots (activity filter)", False, f"Status: {response.status_code}")

        except Exception as e:
            self.log_test("Calendar Available", False, f"Error: {str(e)}")

    def test_client_bookings(self):
        """Test client booking operations"""
        if not self.client_token:
            self.log_test("Client Bookings", False, "No client token available")
            return

        try:
            # Get client's existing bookings
            response = self.make_request("GET", "bookings/my", use_token=self.client_token)
            if response.status_code == 200:
                existing_bookings = response.json()
                self.log_test("Get my bookings", True, f"Client has {len(existing_bookings)} existing bookings")
            else:
                self.log_test("Get my bookings", False, f"Status: {response.status_code}")
                return

            # Get available slots
            response = self.make_request("GET", "calendar/available", use_token=self.client_token)
            if response.status_code == 200:
                slots = response.json()
                available_slots = [slot for slot in slots if slot.get("available", False)]
                
                if available_slots:
                    # Try to book the first available slot
                    slot_to_book = available_slots[0]
                    booking_data = {"slot_id": slot_to_book["slot_id"]}
                    
                    response = self.make_request("POST", "bookings", booking_data, use_token=self.client_token)
                    if response.status_code == 200:
                        booking = response.json()
                        booking_id = booking.get("booking_id")
                        self.log_test("Create booking", True, f"Booking created with ID: {booking_id}")
                        
                        # Try to cancel the booking
                        response = self.make_request("DELETE", f"bookings/{booking_id}", use_token=self.client_token)
                        if response.status_code == 200:
                            cancel_data = response.json()
                            refunded = cancel_data.get("refunded", False)
                            credits_refunded = cancel_data.get("credits_refunded", 0)
                            self.log_test("Cancel booking", True, f"Booking cancelled, refunded: {refunded}, credits: {credits_refunded}")
                        else:
                            self.log_test("Cancel booking", False, f"Status: {response.status_code}")
                    else:
                        self.log_test("Create booking", False, f"Status: {response.status_code}, Response: {response.text}")
                else:
                    self.log_test("Create booking", False, "No available slots to book")
            else:
                self.log_test("Client Bookings", False, f"Could not get available slots: {response.status_code}")

        except Exception as e:
            self.log_test("Client Bookings", False, f"Error: {str(e)}")

    def test_user_registration(self):
        """Test user registration"""
        try:
            # Generate unique email for test with valid domain
            timestamp = int(datetime.now().timestamp())
            registration_data = {
                "name": f"Test User {timestamp}",
                "email": f"test_user_{timestamp}@example.com",
                "password": "testpass123",
                "role": "client"
            }
            
            response = self.make_request("POST", "auth/register", registration_data)
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    user = data["user"]
                    self.log_test("User registration", True, f"User {user.get('email')} registered successfully")
                else:
                    self.log_test("User registration", False, "Missing token or user in response")
            else:
                self.log_test("User registration", False, f"Status: {response.status_code}, Response: {response.text}")

        except Exception as e:
            self.log_test("User registration", False, f"Error: {str(e)}")

    def test_invalid_credentials(self):
        """Test authentication with invalid credentials"""
        try:
            invalid_data = {
                "email": "invalid@user.com",
                "password": "wrongpassword"
            }
            
            response = self.make_request("POST", "auth/login", invalid_data)
            if response.status_code == 401:
                self.log_test("Invalid credentials handling", True, "Correctly rejected invalid credentials")
            else:
                self.log_test("Invalid credentials handling", False, f"Expected 401, got {response.status_code}")

        except Exception as e:
            self.log_test("Invalid credentials handling", False, f"Error: {str(e)}")

    def test_unauthorized_admin_access(self):
        """Test unauthorized access to admin endpoints"""
        if not self.client_token:
            self.log_test("Unauthorized admin access", False, "No client token available")
            return

        try:
            # Try to access admin endpoint with client token
            response = self.make_request("GET", "admin/slots", use_token=self.client_token)
            
            if response.status_code == 403:
                self.log_test("Unauthorized admin access", True, "Correctly rejected client access to admin endpoint")
            else:
                self.log_test("Unauthorized admin access", False, f"Expected 403, got {response.status_code}")

        except Exception as e:
            self.log_test("Unauthorized admin access", False, f"Error: {str(e)}")

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Spark Fit API Tests")
        print("=" * 50)
        
        # Basic connectivity
        if not self.test_root_endpoint():
            print("❌ API not accessible, stopping tests")
            return False

        # Authentication tests
        self.test_admin_login()
        self.test_client_login()
        self.test_auth_me_endpoint()
        self.test_user_registration()
        self.test_invalid_credentials()
        self.test_unauthorized_admin_access()

        # Admin functionality tests
        self.test_admin_slots_crud()
        self.test_admin_users_endpoint()
        self.test_admin_bookings_endpoint()

        # Client functionality tests
        self.test_calendar_available()
        self.test_client_bookings()

        # Summary
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("✅ All tests passed!")
            return True
        else:
            print(f"❌ {self.tests_run - self.tests_passed} tests failed")
            return False

    def get_summary_report(self):
        """Get summary report of test results"""
        passed_tests = [test for test in self.test_results if test["passed"]]
        failed_tests = [test for test in self.test_results if not test["passed"]]
        
        return {
            "total_tests": self.tests_run,
            "passed_tests": [test["name"] for test in passed_tests],
            "failed_tests": [{"name": test["name"], "details": test["details"]} for test in failed_tests],
            "success_rate": round((self.tests_passed / self.tests_run) * 100, 2) if self.tests_run > 0 else 0
        }

def main():
    """Main function to run all tests"""
    tester = SparkFitAPITester()
    success = tester.run_all_tests()
    
    # Print summary
    summary = tester.get_summary_report()
    print(f"\n📈 Success Rate: {summary['success_rate']}%")
    
    if summary['failed_tests']:
        print("\n❌ Failed Tests:")
        for test in summary['failed_tests']:
            print(f"  - {test['name']}: {test['details']}")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())