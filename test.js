async function test() {
  const response = await fetch('http://localhost:3000/api/auth/check-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: 'test@example.com' })
  });
  const data = await response.json();
  console.log(data);
}
test();