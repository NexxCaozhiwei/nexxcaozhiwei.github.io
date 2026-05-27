---
layout: default
title: Home
---

# NexxCaozhiwei

This is my personal homepage for projects, notes, and updates.

## Featured

- [Jelly](./jelly/) - Main project page.
- [GitHub](https://github.com/NexxCaozhiwei) - Public repositories and code.
- [About](./about/) - Profile and contact information.

## Latest Notes

{% for post in site.posts limit:3 %}
- [{{ post.title }}]({{ post.url | relative_url }}) - {{ post.date | date: "%Y-%m-%d" }}
{% endfor %}

## Contact

- GitHub: [NexxCaozhiwei](https://github.com/NexxCaozhiwei)
- Email: your-email@example.com
