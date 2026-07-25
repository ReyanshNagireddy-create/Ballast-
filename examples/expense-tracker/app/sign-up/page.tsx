export default function SignUpPage() {
  return (
    <main>
      <h1>Create your account</h1>
      <form action="/api/register" method="post">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required />

        <input name="password" type="password" placeholder="Password" required />
        <input name="confirmPassword" type="password" placeholder="Confirm password" required />
        <input name="fullName" type="text" placeholder="Full name" required />
        <input name="phone" type="tel" placeholder="Phone number" required />
        <input name="postcode" type="text" placeholder="Postcode" required />
        <input name="referral" type="text" placeholder="How did you hear about us?" required />

        <select name="currency" required>
          <option>GBP</option>
          <option>USD</option>
        </select>

        <button type="submit">Create account</button>
      </form>
    </main>
  );
}
