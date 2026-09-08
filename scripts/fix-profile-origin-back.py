from pathlib import Path

path = Path('src/pages/Profile.jsx')
text = path.read_text()
old = """  const goBack = () => {
    const returnTo = location.state?.from;
    if (returnTo) navigate(returnTo);
    else navigateBackOr(navigate, isOwnProfile ? '/' : '/explore?view=community');
  };"""
new = """  const goBack = () => {
    const returnTo = location.state?.from;
    navigateBackOr(navigate, returnTo || (isOwnProfile ? '/' : '/explore?view=community'));
  };"""
if old not in text:
    raise SystemExit('Profile goBack anchor not found')
path.write_text(text.replace(old, new, 1))
print('Profile origin-aware back navigation repaired.')
