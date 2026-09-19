import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/pages/register.html', destination: '/register', permanent: true },
      { source: '/pages/home.html', destination: '/', permanent: true },
      { source: '/pages/learn.html', destination: '/learn', permanent: true },
      { source: '/pages/general-knowledge.html', destination: '/general-knowledge', permanent: true },
      { source: '/pages/voting-game.html', destination: '/game', permanent: true },
      { source: '/pages/quiz.html', destination: '/quiz', permanent: true },
      { source: '/pages/completion.html', destination: '/completion', permanent: true },
    ];
  },
};

export default nextConfig;
