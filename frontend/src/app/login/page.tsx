import { redirect } from 'next/navigation';
import { auth, signIn } from '@/lib/auth';

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  const resolvedSearchParams = (await searchParams) ?? {};
  const callbackUrl = getSearchParam(resolvedSearchParams, 'callbackUrl') ?? '/';
  const error = getSearchParam(resolvedSearchParams, 'error');

  if (session) {
    redirect('/');
  }

  async function loginAction() {
    'use server';
    await signIn('keycloak', { redirectTo: callbackUrl });
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-logo" aria-hidden="true">IDR</div>
        <h1 id="login-title">Ingreso al Inventario de Red</h1>
        <p>Accedé con tu cuenta institucional para continuar.</p>
        {error ? (
          <p className="login-error" role="alert">
            No pudimos iniciar sesión. Intentá nuevamente o contactá a soporte si el problema continúa.
          </p>
        ) : null}
        <form action={loginAction}>
          <button className="login-button" type="submit">Ingresar con Keycloak</button>
        </form>
      </section>
    </main>
  );
}
