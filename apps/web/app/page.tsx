export default function HomePage() {
  return (
    <section className="card">
      <h1>Clerk in Next.js App Router is connected.</h1>
      <p>
        Use top-right sign in/sign up to authenticate on this host.
      </p>
      <p>
        After sign in, extension background reads the same host session via
        `syncHost` and popup status updates automatically.
      </p>
    </section>
  );
}
