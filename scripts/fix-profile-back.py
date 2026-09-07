from pathlib import Path

path = Path('src/pages/Profile.jsx')
text = path.read_text()
old_import = "import { getSpotPrimaryImage } from '../utils/spotImages';"
new_import = "import { getSpotPrimaryImage } from '../utils/spotImages';\nimport { navigateBackOr } from '../utils/navigation';"
if old_import not in text:
    raise SystemExit('Profile navigation import anchor missing')
text = text.replace(old_import, new_import, 1)
old_back = """  const goBack = () => {
    const returnTo = location.state?.from;
    if (returnTo) navigate(returnTo);
    else if (Number(window.history.state?.idx) > 0) navigate(-1);
    else navigate(isOwnProfile ? '/' : '/explore?view=creators');
  };"""
new_back = """  const goBack = () => {
    const returnTo = location.state?.from;
    if (returnTo) navigate(returnTo);
    else navigateBackOr(navigate, isOwnProfile ? '/' : '/explore?view=creators');
  };"""
if old_back not in text:
    raise SystemExit('Profile navigation block missing')
path.write_text(text.replace(old_back, new_back, 1))
print('Profile safe navigation repaired.')
