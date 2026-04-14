import re

with open(r'd:\flight visulaization\src\App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove comments
content = re.sub(r'//.*', '', content)
content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)

# Find all tags
# This is a bit naive for JSX but let's try
tags = re.findall(r'<(/?[a-zA-Z0-9\.\-]+)', content)

stack = []
for tag in tags:
    if tag.startswith('/'):
        closing = tag[1:]
        if not stack:
            print(f"Error: Found closing tag </{closing}> with no open tag")
        else:
            opening = stack.pop()
            if opening != closing:
                print(f"Error: Mismatched tags! Expected </{opening}>, found </{closing}>")
    else:
        # Check if it's self-closing (naively)
        # We'll just push it and see what happens
        # In JSX, some tags are self-closing if they end with />
        pass

# Re-try with a better regex that handles self-closing tags
# This regex matches <tag> or </tag> or <tag />
jsx_tags = re.findall(r'<(/?[a-zA-Z0-9\.\-]+)(?:\s+[^>]*?)?(/?)>', content)

stack = []
for tag, self_close in jsx_tags:
    if self_close == '/':
        # Self-closing tag
        continue
    if tag.startswith('/'):
        closing = tag[1:].lower()
        if not stack:
            print(f"Error: Found closing tag </{tag[1:]}> with no open tag")
        else:
            opening = stack.pop().lower()
            if opening != closing:
                print(f"Error: Mismatched tags! Opened <{opening}>, closed </{tag[1:]}>")
    else:
        # Check if it's a component or HTML tag
        # For this tool, we'll treat them all the same
        stack.append(tag)

if stack:
    print(f"Error: Unclosed tags in stack: {stack}")
else:
    print("Tags seem balanced!")
