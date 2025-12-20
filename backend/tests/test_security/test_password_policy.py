"""
Tests for password validation policy.

These tests verify that the password validators are properly configured
to enforce strong password requirements.
"""

import pytest
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError


class TestPasswordPolicy:
    """Tests for password validation rules."""

    def test_rejects_short_passwords(self):
        """Should reject passwords under 12 characters."""
        with pytest.raises(ValidationError) as exc_info:
            validate_password('Short1234!')

        # Check that MinimumLengthValidator is the source
        errors = [str(e) for e in exc_info.value.messages]
        assert any('12' in e or 'short' in e.lower() or 'characters' in e.lower() for e in errors)

    def test_accepts_12_char_password(self):
        """Should accept passwords of exactly 12 characters."""
        # A 12+ char password that meets all requirements
        try:
            validate_password('SecurePass123!')
        except ValidationError:
            pytest.fail('12+ character password should be accepted')

    def test_rejects_common_passwords(self):
        """Should reject common passwords."""
        common_passwords = [
            'password1234',
            'qwerty123456',
            '123456789012',
        ]

        for password in common_passwords:
            with pytest.raises(ValidationError):
                validate_password(password)

    def test_rejects_numeric_only_passwords(self):
        """Should reject passwords that are entirely numeric."""
        with pytest.raises(ValidationError) as exc_info:
            validate_password('123456789012')

        errors = [str(e) for e in exc_info.value.messages]
        assert any('numeric' in e.lower() or 'number' in e.lower() for e in errors)

    def test_accepts_strong_password(self):
        """Should accept a strong password meeting all requirements."""
        strong_passwords = [
            'MyS3cur3P@ssw0rd!',
            'Compl3x_Password_Here',
            'N0tACommonPhraseAtAll!',
        ]

        for password in strong_passwords:
            try:
                validate_password(password)
            except ValidationError:
                pytest.fail(f'Strong password "{password}" should be accepted')

    def test_rejects_too_similar_to_user_attributes(self):
        """Should reject passwords similar to user info when user is provided."""
        from django.contrib.auth import get_user_model

        User = get_user_model()

        # Create an unsaved user instance - no database needed for validation
        user = User(
            email='johndoe@example.com',
            first_name='John',
            last_name='Doe',
        )

        # Password containing user's name should be rejected
        with pytest.raises(ValidationError):
            validate_password('johndoe12345!', user=user)
