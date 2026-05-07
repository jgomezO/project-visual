"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
import { createBrowserClient } from "@supabase/ssr";
import { LogIn } from "lucide-react";
import { useTranslations } from "next-intl";

// Browser-side OAuth trigger. signInWithOAuth either redirects the
// browser to Google (success) or returns an error. On success, we
// never reach the next line — the page navigates away. On error,
// surface the message so the user can retry instead of seeing a
// silent button that "didn't do anything".
//
// `oauthError.message` from Supabase deliberately stays untranslated:
// it comes from the SDK with its own localization story we don't
// control. The visible-to-user fallback is rare (most errors land in
// /auth/callback redirects, not here).
export function LoginButton() {
  const t = useTranslations("auth.login.cta");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn(): Promise<void> {
    setPending(true);
    setError(null);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Must match a URL registered in Supabase → Authentication →
        // URL Configuration → Redirect URLs.
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (oauthError) {
      console.error("OAuth init failed:", oauthError);
      setError(oauthError.message);
      setPending(false);
    }
    // Success path: the browser is already navigating. Leaving pending
    // ON keeps the button disabled until the navigation completes.
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onPress={handleSignIn} isDisabled={pending}>
        <LogIn className="size-4" aria-hidden="true" />
        {pending ? t("pending") : t("idle")}
      </Button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
