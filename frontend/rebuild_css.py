import re

with open(r'e:\pjei_portfolios\index.html', 'r', encoding='utf-8') as f:
    html = f.read()

style_match = re.search(r'<style>(.*?)</style>', html, re.DOTALL)
if style_match:
    styles = style_match.group(1)
    
    # 0. Noto Sans Lao
    styles = styles.replace(
        "family=JetBrains+Mono:wght@300;400;500;600;700&display=swap",
        "family=JetBrains+Mono:wght@300;400;500;600;700&family=Noto+Sans+Lao:wght@300;400;500;600;700&display=swap"
    )

    # 1. Add Tailwind CSS and font theme (Required for Vite + Tailwind)
    prefix = '''@import "tailwindcss";

@theme {
  --font-sans: "Inter", "Noto Sans Lao", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  --font-grotesk: "Space Grotesk", sans-serif;
}

'''
    
    # 2. Add .typing-dot for ChatWidget
    typing_dot_css = '''
        .typing-dot {
            width: 8px;
            height: 8px;
            background-color: var(--accent-cyan);
            border-radius: 50%;
            animation: bounce 1s infinite;
        }
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }
    '''
    
    styles = prefix + styles + typing_dot_css
    
    # 3. Change floating buttons position
    styles = styles.replace('right: 2rem;', 'left: 2rem;')
    
    # 4. Remove double cursor
    styles = re.sub(r'\.holo-text::after\s*\{[^}]*\}', '', styles, flags=re.DOTALL)
    
    # 5. Fix aurora-bg to make it blue (Galaxy feel)
    # The original aurora-bg has `#FF64DA`, `#00D0FF` etc. I will change them to blue variants.
    styles = styles.replace('rgba(255, 100, 218, 0.15)', 'rgba(0, 208, 255, 0.2)')
    styles = styles.replace('rgba(0, 208, 255, 0.15)', 'rgba(0, 100, 255, 0.2)')
    styles = styles.replace('rgba(255, 100, 218, 0.1)', 'rgba(0, 208, 255, 0.1)')
    styles = styles.replace('rgba(0, 208, 255, 0.1)', 'rgba(0, 100, 255, 0.1)')
    
    with open(r'e:\pjei_portfolios\frontend\src\index.css', 'w', encoding='utf-8') as out:
        out.write(styles)
    print("Successfully rebuilt index.css without syntax errors!")
else:
    print("Could not find <style> in index.html")
