import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { analytics } from '@/lib/analytics';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Eye, EyeOff, Shield, CheckCircle, ArrowRight } from 'lucide-react';
import { stripe, auth } from '@/lib/api-client';
import { SEOHead } from '@/components/SEOHead';
import { PublicLayout } from '@/components/PublicLayout';
import { cn } from '@/lib/utils';
import * as LabelPrimitive from '@radix-ui/react-label';

// ============ Aceternity-style sub-components ============

const GradientInput = ({ className, type, ...props }: React.ComponentProps<'input'>) => (
  <input
    type={type}
    className={cn(
      'flex h-11 w-full rounded-xl border bg-neutral-900 px-4 py-2 text-sm text-white placeholder:text-neutral-500 transition-all outline-none',
      'border-white/[0.08] focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/20',
      'shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.3),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)]',
      className
    )}
    {...props}
  />
);

const GradientLabel = ({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) => (
  <LabelPrimitive.Root
    className={cn('text-sm font-medium text-neutral-200 select-none', className)}
    {...props}
  />
);

const GradientButton = ({ children, disabled, className, ...props }: React.ComponentProps<'button'>) => (
  <button
    disabled={disabled}
    className={cn(
      'w-full h-12 rounded-xl px-6 py-2 text-center text-base font-semibold transition-all duration-150 active:scale-[0.98]',
      'bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/25',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-cyan-500',
      className
    )}
    {...props}
  >
    {children}
  </button>
);

// Mesh gradient canvas (from Aceternity)
function resolveCssColorToRGB(color: string): [number, number, number] {
  const el = document.createElement('div');
  el.style.color = color;
  document.body.appendChild(el);
  const computed = getComputedStyle(el).color;
  document.body.removeChild(el);
  const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return [6, 182, 212];
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

const MeshGradient: React.FC<{ className?: string }> = ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const colors = ['#06b6d4', '#0891b2', '#0e7490', '#164e63', '#083344'];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true });
    if (!gl) return;

    const vertexSrc = `attribute vec2 a_position; varying vec2 v_uv; void main() { v_uv = a_position * 0.5 + 0.5; gl_Position = vec4(a_position, 0.0, 1.0); }`;
    const fragmentSrc = `
      precision mediump float;
      varying vec2 v_uv;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec3 u_colors[5];
      float hash(vec2 p) { p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
      void main() {
        vec2 uv = v_uv; uv.x *= u_resolution.x / u_resolution.y;
        float t = u_time;
        vec2 p0 = 0.52 + 0.35*vec2(sin(0.7*t), cos(0.9*t));
        vec2 p1 = 0.48 + 0.35*vec2(sin(0.6*t+1.7), cos(0.8*t+2.3));
        vec2 p2 = 0.50 + 0.38*vec2(sin(0.9*t+0.7), cos(0.7*t+1.7));
        vec2 p3 = 0.46 + 0.33*vec2(sin(0.5*t+2.9), cos(1.1*t+0.2));
        vec2 p4 = 0.50 + 0.30*vec2(sin(0.8*t-1.4), cos(0.6*t-0.9));
        float d0 = distance(uv, p0); float d1 = distance(uv, p1); float d2 = distance(uv, p2); float d3 = distance(uv, p3); float d4 = distance(uv, p4);
        float w0 = smoothstep(0.85, 0.05, d0); float w1 = smoothstep(0.85, 0.05, d1); float w2 = smoothstep(0.90, 0.05, d2); float w3 = smoothstep(0.95, 0.05, d3); float w4 = smoothstep(0.90, 0.05, d4);
        vec3 col = u_colors[0]*w0 + u_colors[1]*w1 + u_colors[2]*w2 + u_colors[3]*w3 + u_colors[4]*w4;
        col /= (w0+w1+w2+w3+w4+1e-3);
        col += (hash(uv*u_resolution*0.5+u_time)-0.5)*0.02;
        col *= smoothstep(1.1,0.35,length(uv-vec2(0.5)));
        gl_FragColor = vec4(col, 1.0);
      }`;

    function compile(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      return s;
    }
    const vs = compile(gl.VERTEX_SHADER, vertexSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fragmentSrc);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uColors = gl.getUniformLocation(program, 'u_colors');

    const rgb = colors.map(c => { const [r,g,b] = resolveCssColorToRGB(c); return [r/255,g/255,b/255]; }).flat();
    gl.uniform3fv(uColors, new Float32Array(rgb));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      canvas.width = w; canvas.height = h;
      gl!.viewport(0, 0, w, h);
      gl!.uniform2f(uRes, w, h);
    };
    resize();
    window.addEventListener('resize', resize);

    const start = performance.now();
    const loop = () => {
      gl!.uniform1f(uTime, ((performance.now() - start) / 1000) * 0.5);
      gl!.drawArrays(gl!.TRIANGLES, 0, 6);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className={cn('h-full w-full', className)} />;
};

// ============ Main Auth Component ============

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(searchParams.get('mode') === 'signup');
  const [isReset, setIsReset] = useState(searchParams.get('mode') === 'reset');
  const [resetToken] = useState(searchParams.get('token') || '');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  const isVerified = searchParams.get('verified') === 'true';
  const redirectTo = searchParams.get('redirect');

  useEffect(() => {
    if (isVerified && !user) {
      toast.success('Email verified successfully! Please wait while we redirect you...');
    }
    if (user) {
      const storedPlan = localStorage.getItem('selectedPlan');
      if (storedPlan) {
        const plan = JSON.parse(storedPlan);
        localStorage.removeItem('selectedPlan');
        if (isVerified) toast.success('Email verified! Redirecting to checkout...');
        handleCheckout(plan);
        return;
      }
      navigate(redirectTo || '/app');
    }
  }, [user, navigate, isVerified, redirectTo]);

  const handleCheckout = async (plan: any) => {
    try {
      const response = await stripe.createCheckout(plan.name, false);
      if (response.error) throw new Error(response.error);
      if ((response.data as any)?.url) {
        window.open((response.data as any).url, '_blank');
        toast.success('Redirecting to checkout...');
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to start checkout process');
      navigate('/pricing');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const response = await auth.resetPassword(resetToken, password);
      if (response.error) toast.error(response.error);
      else { setResetSuccess(true); toast.success('Password reset successfully!'); }
    } catch { toast.error('Failed to reset password. The link may have expired.'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName);
        if (error) {
          if (error.message.includes('already') || error.message.includes('registered') || error.message.includes('Email already')) {
            toast.error('An account with this email already exists. Please sign in instead.');
            setIsSignUp(false);
          } else toast.error(error.message);
        } else {
          toast.success('Welcome to AIWholesail! Your 7-day free trial has started.');
          analytics.signUp('email'); analytics.beginTrial('Pro');
          localStorage.removeItem('selectedPlan');
          navigate(redirectTo || '/app');
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid') || error.message.includes('credentials'))
            toast.error('Invalid email or password. Please try again.');
          else toast.error(error.message);
        } else {
          toast.success('Signed in successfully!');
          analytics.login('email');
          navigate(redirectTo || '/app');
        }
      }
    } catch { toast.error('An unexpected error occurred. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <PublicLayout>
      <SEOHead
        title={isReset ? 'Reset Password' : isSignUp ? 'Create Account' : 'Sign In'}
        description={isReset ? 'Reset your AIWholesail password.' : isSignUp ? 'Create your AIWholesail account and start finding profitable real estate deals with our 7-day free trial.' : 'Sign in to your AIWholesail account to access your real estate deal-finding dashboard.'}
        noIndex={false}
      />

      <section className="relative bg-[#08090a] text-white min-h-[calc(100vh-80px)]">
        <div className="mx-auto max-w-7xl py-10 md:py-20">
          <div className="grid grid-cols-1 gap-10 px-4 md:grid-cols-2 md:px-8 lg:gap-20">

            {/* ===== LEFT: FORM ===== */}
            <div className="pt-10 md:pt-16">
              <Link to="/" className="inline-block mb-6">
                <img src="/logo-white.png" alt="AIWholesail" className="h-8 w-auto" />
              </Link>

              <h1 className="text-left text-3xl font-bold tracking-tight text-white lg:text-5xl">
                {isReset ? 'Reset your password' : isSignUp ? 'Create your account' : 'Welcome back'}
              </h1>
              <p className="mt-3 max-w-md text-left text-sm font-medium text-neutral-400 lg:text-base">
                {isReset
                  ? 'Enter your new password below to regain access.'
                  : isSignUp
                  ? 'Start finding profitable real estate deals today with a 7-day free trial.'
                  : 'Sign in to access your dashboard and continue finding profitable deals.'}
              </p>

              {/* PASSWORD RESET FORM */}
              {isReset ? (
                resetSuccess ? (
                  <div className="mt-8 space-y-4">
                    <CheckCircle className="h-12 w-12 text-cyan-400" />
                    <h3 className="text-xl font-semibold">Password Reset Successfully</h3>
                    <p className="text-sm text-neutral-400">You can now sign in with your new password.</p>
                    <GradientButton onClick={() => { setIsReset(false); setResetSuccess(false); }}>
                      Sign In <ArrowRight className="inline h-4 w-4 ml-2" />
                    </GradientButton>
                  </div>
                ) : (
                  <form className="mt-8 flex flex-col gap-5" onSubmit={handleResetPassword}>
                    <div>
                      <GradientLabel>New Password</GradientLabel>
                      <div className="relative mt-2">
                        <GradientInput
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter new password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={8}
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="mt-1.5 text-xs text-neutral-500">Min 8 characters with uppercase, lowercase, number, and special character</p>
                    </div>
                    <div>
                      <GradientLabel>Confirm Password</GradientLabel>
                      <GradientInput
                        className="mt-2"
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={8}
                      />
                    </div>
                    <GradientButton type="submit" disabled={loading}>
                      {loading ? 'Resetting...' : 'Reset Password'}
                    </GradientButton>
                  </form>
                )
              ) : (
                <form className="mt-8 flex flex-col gap-5" onSubmit={handleSubmit}>
                  {isSignUp && (
                    <div>
                      <GradientLabel>Full Name</GradientLabel>
                      <GradientInput
                        className="mt-2"
                        type="text"
                        placeholder="Enter your full name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>
                  )}
                  <div>
                    <GradientLabel>Email</GradientLabel>
                    <GradientInput
                      className="mt-2"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <GradientLabel>Password</GradientLabel>
                    <div className="relative mt-2">
                      <GradientInput
                        type={showPassword ? 'text' : 'password'}
                        placeholder={isSignUp ? 'Create a strong password' : 'Enter your password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {isSignUp && (
                      <p className="mt-1.5 text-xs text-neutral-500">Min 8 characters with uppercase, lowercase, number, and special character</p>
                    )}
                    {!isSignUp && (
                      <div className="mt-2 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!email) { toast.error('Please enter your email address first.'); return; }
                            try {
                              const response = await auth.forgotPassword(email);
                              if (response.error) toast.error(response.error);
                              else toast.success('Password reset link sent! Check your email.');
                            } catch { toast.error('Failed to send reset link. Please try again.'); }
                          }}
                          className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                        >
                          Forgot password?
                        </button>
                      </div>
                    )}
                  </div>

                  <GradientButton type="submit" disabled={loading}>
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        {isSignUp ? 'Create Account' : 'Sign In'}
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    )}
                  </GradientButton>
                </form>
              )}

              {/* Trust + Switch mode */}
              <div className="mt-6 flex items-center gap-4 text-xs text-neutral-500">
                <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-cyan-400" /> Secure</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-cyan-400" /> 10,000+ Users</span>
              </div>
              {!isReset && (
                <div className="mt-4">
                  <span className="text-sm text-neutral-400">
                    {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    {isSignUp ? 'Sign In' : 'Create Account'}
                  </button>
                </div>
              )}
            </div>

            {/* ===== RIGHT: ILLUSTRATION ===== */}
            <div className="relative hidden min-h-[500px] flex-col items-start justify-end overflow-hidden rounded-2xl bg-black p-6 md:flex md:p-10">
              {/* Decorative rotated squares */}
              <div className="mask-r-from-50% absolute -top-48 -right-40 z-20 grid rotate-45 transform grid-cols-4 gap-32">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="size-40 shrink-0 rounded-3xl bg-neutral-900 shadow-[0px_2px_0px_0px_var(--color-neutral-600)_inset]" />
                ))}
              </div>
              <div className="mask-r-from-50% absolute -top-0 -right-10 z-20 grid rotate-45 transform grid-cols-4 gap-32 opacity-50">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="size-40 shrink-0 rounded-3xl bg-neutral-900 shadow-[0px_2px_0px_0px_var(--color-neutral-600)_inset]" />
                ))}
              </div>

              {/* Mesh gradient background */}
              <MeshGradient className="mask-t-from-50% absolute inset-0 z-30 h-full w-[200%] blur-3xl" />

              {/* Content overlay */}
              <div className="relative z-40 mb-2 flex items-center gap-2">
                <p className="rounded-md bg-black/50 px-2 py-1 text-xs text-white">AI-Powered</p>
                <p className="rounded-md bg-black/50 px-2 py-1 text-xs text-white">Real Estate</p>
              </div>
              <div className="relative z-40 max-w-sm rounded-xl bg-black/50 p-5 backdrop-blur-sm">
                <p className="text-white leading-relaxed">
                  "AIWholesail completely changed how I find deals. I went from closing 1 deal a month to 5 — the AI spots opportunities I would have missed."
                </p>
                <p className="mt-4 text-sm text-white/50">Sarah Martinez</p>
                <p className="mt-1 text-sm text-white/50">
                  Real Estate Investor, <span className="font-bold">Houston, TX</span>
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
