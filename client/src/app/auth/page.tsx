"use client";

import {Button, FieldError, Form, Input, Label, Spinner, TextField} from "@heroui/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Layers3 } from "lucide-react";

export default function AuthPage() {
    const { signIn } = useAuthActions();
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [error, setError] = useState("");
    const submitting = useRef(false);

    const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (submitting.current) return;

        const formData = new FormData(event.currentTarget);
        formData.set("email", String(formData.get("email") ?? "").trim());
        formData.set("flow", "signIn");
        submitting.current = true;
        setIsSigningIn(true);
        setError("");

        try {
            const result = await signIn("password", formData);
            if (!result.signingIn) {
                throw new Error("Sign-in incomplete");
            }
            window.location.replace("/");
        } catch {
            setError("Unable to sign in. Check your email and password and try again.");
            submitting.current = false;
            setIsSigningIn(false);
        }
    };

    return (
        <main className="flex flex-col my-auto mx-auto w-full max-w-sm px-4 py-10 sm:px-8 sm:py-14">
            <Link href="/" className="flex flex-col gap-2 text-xl font-semibold text-foreground no-underline items-center mb-5">
                <Layers3 className="size-7 text-accent" aria-hidden="true" />
                Offerwell
            </Link>

            <Form className="flex flex-col gap-4" onSubmit={handleSignIn} aria-busy={isSigningIn}>
                <TextField
                    isRequired
                    name="email"
                    type="email"
                    isDisabled={isSigningIn}
                >
                    <Label>Email</Label>
                    <Input placeholder="Enter your email" autoComplete="username" />
                    <FieldError />
                </TextField>

                <TextField
                    isRequired
                    name="password"
                    type="password"
                    isDisabled={isSigningIn}
                >
                    <Label>Password</Label>
                    <Input placeholder="Enter your password" autoComplete="current-password" />
                    <FieldError />
                </TextField>

                {error && <p role="alert" className="text-sm text-danger">{error}</p>}

                <div className="flex flex-1">
                    <Button type="submit" className="w-full" isDisabled={isSigningIn}>
                        {isSigningIn && <Spinner size="sm" />}
                        {isSigningIn ? "Signing In..." : "Sign In"}
                    </Button>
                </div>
            </Form>
        </main>
    );
}
