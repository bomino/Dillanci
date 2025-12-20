"""
HTML sanitization utilities for preventing XSS attacks.

This module provides functions to sanitize user-generated content,
removing potentially malicious HTML while preserving safe formatting.
"""

import re

import bleach

# Tags allowed in rich text fields (safe for display)
ALLOWED_TAGS = frozenset([
    'b', 'i', 'u', 'em', 'strong',  # Text formatting
    'p', 'br',                       # Paragraphs and line breaks
    'ul', 'ol', 'li',                # Lists
    'a',                             # Links (with restricted attributes)
    'blockquote',                    # Quotes
    'code', 'pre',                   # Code blocks
])

# Tags whose content should be completely removed (not just the tags)
DANGEROUS_TAGS_WITH_CONTENT = ['script', 'style', 'iframe', 'object', 'embed', 'form']

# Allowed attributes per tag
ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title'],  # Links can have href and title only
}

# Allowed URL schemes for links (prevents javascript: and data: URLs)
ALLOWED_PROTOCOLS = frozenset(['http', 'https', 'mailto'])

# Regex pattern to remove dangerous tags AND their content
_DANGEROUS_TAG_PATTERN = re.compile(
    r'<\s*(' + '|'.join(DANGEROUS_TAGS_WITH_CONTENT) + r')\b[^>]*>.*?</\s*\1\s*>',
    re.IGNORECASE | re.DOTALL
)

# Pattern for self-closing dangerous tags
_DANGEROUS_SELFCLOSE_PATTERN = re.compile(
    r'<\s*(' + '|'.join(DANGEROUS_TAGS_WITH_CONTENT) + r')\b[^>]*/?\s*>',
    re.IGNORECASE
)


def _remove_dangerous_content(text: str) -> str:
    """Remove dangerous tags along with their content."""
    # Remove tags with content (e.g., <script>...</script>)
    text = _DANGEROUS_TAG_PATTERN.sub('', text)
    # Remove any remaining self-closing dangerous tags
    text = _DANGEROUS_SELFCLOSE_PATTERN.sub('', text)
    return text


def sanitize_html(text: str) -> str:
    """
    Sanitize HTML input, keeping only allowed safe tags.

    This function should be used for rich text fields where users
    may submit formatted content (e.g., descriptions, comments).

    Dangerous tags like <script> and <style> are removed along with
    their content to prevent XSS attacks.

    Args:
        text: The input text that may contain HTML

    Returns:
        Sanitized text with only allowed HTML tags preserved

    Example:
        >>> sanitize_html('<script>alert("xss")</script><b>Hello</b>')
        '<b>Hello</b>'
        >>> sanitize_html('<a href="javascript:evil()">Click</a>')
        '<a>Click</a>'
    """
    if not text:
        return text

    # First, remove dangerous tags AND their content
    text = _remove_dangerous_content(text)

    # Then use bleach to clean remaining HTML
    return bleach.clean(
        text,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,  # Strip disallowed tags rather than escaping them
    )


def strip_all_html(text: str) -> str:
    """
    Remove all HTML tags from text, returning plain text only.

    This function should be used for fields that should contain
    only plain text (e.g., names, titles, short descriptions).

    Dangerous tags like <script> and <style> have their content
    removed entirely, while other tags have only the tags stripped
    (content preserved).

    Args:
        text: The input text that may contain HTML

    Returns:
        Plain text with all HTML tags removed

    Example:
        >>> strip_all_html('<b>Hello</b> <script>alert("x")</script>World')
        'Hello World'
    """
    if not text:
        return text

    # First, remove dangerous tags AND their content
    text = _remove_dangerous_content(text)

    # Then strip all remaining tags
    return bleach.clean(text, tags=[], strip=True)


def sanitize_url(url: str) -> str:
    """
    Sanitize a URL to prevent javascript: and other dangerous protocols.

    Args:
        url: The URL to sanitize

    Returns:
        Sanitized URL or empty string if protocol is not allowed
    """
    if not url:
        return url

    # bleach.clean doesn't handle bare URLs, so check manually
    url_lower = url.lower().strip()

    for protocol in ALLOWED_PROTOCOLS:
        if url_lower.startswith(f"{protocol}:"):
            return url

    # If URL starts with / or is relative, it's safe
    if url_lower.startswith('/') or not ':' in url_lower.split('/')[0]:
        return url

    # Dangerous protocol detected
    return ''
