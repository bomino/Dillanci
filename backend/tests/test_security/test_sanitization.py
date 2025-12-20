"""
Tests for HTML sanitization utilities.

These tests verify that the sanitization functions properly protect
against XSS attacks while preserving allowed formatting.
"""

import pytest

from apps.core.utils.sanitization import sanitize_html, strip_all_html, sanitize_url


class TestSanitizeHtml:
    """Tests for sanitize_html function."""

    def test_preserves_allowed_tags(self):
        """Should preserve allowed HTML tags."""
        html = '<p>Hello <strong>world</strong>!</p>'
        result = sanitize_html(html)
        assert '<p>' in result
        assert '<strong>' in result
        assert '</p>' in result
        assert '</strong>' in result

    def test_preserves_list_tags(self):
        """Should preserve list formatting."""
        html = '<ul><li>Item 1</li><li>Item 2</li></ul>'
        result = sanitize_html(html)
        assert '<ul>' in result
        assert '<li>' in result

    def test_removes_script_tags(self):
        """Should remove script tags completely."""
        html = '<script>alert("xss")</script>Hello'
        result = sanitize_html(html)
        assert '<script>' not in result
        assert 'alert' not in result
        assert 'Hello' in result

    def test_removes_onclick_handlers(self):
        """Should remove event handler attributes."""
        html = '<a onclick="evil()" href="#">Click</a>'
        result = sanitize_html(html)
        assert 'onclick' not in result
        assert '<a' in result

    def test_removes_javascript_urls(self):
        """Should remove javascript: URLs from links."""
        html = '<a href="javascript:alert(1)">Click</a>'
        result = sanitize_html(html)
        assert 'javascript:' not in result

    def test_allows_safe_urls(self):
        """Should preserve safe http/https URLs."""
        html = '<a href="https://example.com">Link</a>'
        result = sanitize_html(html)
        assert 'href="https://example.com"' in result

    def test_removes_img_with_onerror(self):
        """Should remove img tags with onerror (img not in allowed tags)."""
        html = '<img src="x" onerror="alert(1)">Text'
        result = sanitize_html(html)
        assert '<img' not in result
        assert 'onerror' not in result
        assert 'Text' in result

    def test_removes_svg_tags(self):
        """Should remove SVG tags which can contain XSS."""
        html = '<svg onload="alert(1)"><circle></circle></svg>Safe'
        result = sanitize_html(html)
        assert '<svg' not in result
        assert 'onload' not in result
        assert 'Safe' in result

    def test_removes_iframe_tags(self):
        """Should remove iframe tags."""
        html = '<iframe src="http://evil.com"></iframe>Text'
        result = sanitize_html(html)
        assert '<iframe' not in result
        assert 'Text' in result

    def test_handles_empty_string(self):
        """Should handle empty string input."""
        result = sanitize_html('')
        assert result == ''

    def test_handles_none_input(self):
        """Should handle None input."""
        result = sanitize_html(None)
        assert result is None

    def test_preserves_br_tags(self):
        """Should preserve line break tags."""
        html = 'Line 1<br>Line 2'
        result = sanitize_html(html)
        assert '<br>' in result

    def test_preserves_emphasis_tags(self):
        """Should preserve emphasis formatting."""
        html = '<em>emphasized</em> and <i>italic</i>'
        result = sanitize_html(html)
        assert '<em>' in result
        assert '<i>' in result

    def test_removes_style_tags(self):
        """Should remove style tags."""
        html = '<style>body { display: none; }</style>Text'
        result = sanitize_html(html)
        assert '<style>' not in result
        assert 'display' not in result
        assert 'Text' in result

    def test_removes_data_urls(self):
        """Should remove data: URLs."""
        html = '<a href="data:text/html,<script>alert(1)</script>">Click</a>'
        result = sanitize_html(html)
        assert 'data:' not in result

    def test_removes_form_tags(self):
        """Should remove form tags which could be used for phishing."""
        html = '<form action="http://evil.com"><input type="text"></form>'
        result = sanitize_html(html)
        assert '<form' not in result
        assert '<input' not in result


class TestStripAllHtml:
    """Tests for strip_all_html function."""

    def test_removes_all_tags(self):
        """Should remove all HTML tags."""
        html = '<p><strong>Hello</strong> <em>world</em>!</p>'
        result = strip_all_html(html)
        assert '<' not in result
        assert '>' not in result
        assert 'Hello' in result
        assert 'world' in result

    def test_removes_script_content(self):
        """Should remove script tags and their content."""
        html = '<script>evil()</script>Safe text'
        result = strip_all_html(html)
        assert 'evil' not in result
        assert 'Safe text' in result

    def test_handles_empty_string(self):
        """Should handle empty string input."""
        result = strip_all_html('')
        assert result == ''

    def test_handles_none_input(self):
        """Should handle None input."""
        result = strip_all_html(None)
        assert result is None

    def test_preserves_plain_text(self):
        """Should preserve plain text without HTML."""
        text = 'Just plain text with no HTML'
        result = strip_all_html(text)
        assert result == text


class TestSanitizeUrl:
    """Tests for sanitize_url function."""

    def test_allows_https_urls(self):
        """Should allow HTTPS URLs."""
        url = 'https://example.com/page'
        result = sanitize_url(url)
        assert result == url

    def test_allows_http_urls(self):
        """Should allow HTTP URLs."""
        url = 'http://example.com/page'
        result = sanitize_url(url)
        assert result == url

    def test_allows_mailto_urls(self):
        """Should allow mailto URLs."""
        url = 'mailto:user@example.com'
        result = sanitize_url(url)
        assert result == url

    def test_blocks_javascript_urls(self):
        """Should block javascript: URLs."""
        url = 'javascript:alert(1)'
        result = sanitize_url(url)
        assert result == ''

    def test_blocks_data_urls(self):
        """Should block data: URLs."""
        url = 'data:text/html,<script>alert(1)</script>'
        result = sanitize_url(url)
        assert result == ''

    def test_blocks_vbscript_urls(self):
        """Should block vbscript: URLs."""
        url = 'vbscript:msgbox("xss")'
        result = sanitize_url(url)
        assert result == ''

    def test_allows_relative_urls(self):
        """Should allow relative URLs."""
        url = '/path/to/page'
        result = sanitize_url(url)
        assert result == url

    def test_handles_empty_string(self):
        """Should handle empty string input."""
        result = sanitize_url('')
        assert result == ''

    def test_handles_none_input(self):
        """Should handle None input."""
        result = sanitize_url(None)
        assert result is None

    def test_case_insensitive_protocol_check(self):
        """Should handle mixed case protocols."""
        url = 'JAVASCRIPT:alert(1)'
        result = sanitize_url(url)
        assert result == ''

        url2 = 'HTTPS://example.com'
        result2 = sanitize_url(url2)
        assert result2 == url2
