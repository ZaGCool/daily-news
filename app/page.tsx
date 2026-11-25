"use client";

import { BookOpen } from "lucide-react";
import Link from "next/link";
import Card from "./components/Card";
import { useState } from "react";
import { toast } from "sonner";

export default function Home() {
  const [email, setEmail] = useState("");

  const handleSubscribe = async () => {
    // Handle subscription logic here
    const response = await fetch("/api/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });
    try {
      const data = await response.json();
      toast.success(data.message);
    } catch {
      toast.error("Failed to subscribe.");
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* header */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-900">
            Daily News
            <span className="text-gray-500 text-sm">
              &nbsp;&nbsp;&nbsp;&nbsp;By ZaG
            </span>
          </h1>
        </div>
        <nav className="flex items-center gap-6 mr-10 text-md">
          <Link href="/" className="hover:text-blue-600">
            About
          </Link>
          <Link href="/contact" className="hover:text-blue-600">
            Contact
          </Link>
        </nav>
      </header>
      {/* main content */}
      <main className="flex flex-col items-center justify-center flex-1 px-4 py-8">
        {/* title */}
        <h2 className="text-4xl font-semibold text-gray-800 mb-4">
          Welcome to Daily News
        </h2>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
          Stay up-to-date with the latest news from around the world.
        </p>
        {/* input and subscribe button */}
        <div className="flex items-center mt-6 gap-6">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="min-w-100 px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300"
          />
          <button
            onClick={handleSubscribe}
            className="px-6 py-2 bg-black cursor-pointer text-gray-200 rounded-md hover:text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
          >
            Subscribe
          </button>
        </div>
      </main>
      {/* cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 px-4 m-12">
        <Card
          title="AI"
          description="Latest developments in artificial intelligence."
        />
        <Card
          title="Startups"
          description="Latest news and updates in the startup world."
        />
        <Card title="Technology" description="Latest trends in technology." />
      </div>
    </div>
  );
}
