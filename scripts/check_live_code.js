async function check() {
  const res = await fetch('https://social-media-dashboard-b1mv.onrender.com/Code.gs');
  const text = await res.text();
  const lines = text.split('\n');
  console.log('Total lines:', lines.length);
  console.log('Line 1:', JSON.stringify(lines[0]));
  console.log('Line 2:', JSON.stringify(lines[1]));
  console.log('Line 3:', JSON.stringify(lines[2]));
}
check();
