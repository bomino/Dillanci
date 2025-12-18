import { motion } from 'framer-motion';

// Define floating shapes with their properties
const shapes = [
  {
    id: 1,
    className: 'absolute w-64 h-64 rounded-full bg-primary-200/20 blur-3xl',
    left: '10%',
    top: '20%',
    dx: 40,
    dy: 30,
    rotate: 0,
    duration: 25,
  },
  {
    id: 2,
    className: 'absolute w-96 h-96 rounded-full bg-accent-200/15 blur-3xl',
    left: '60%',
    top: '10%',
    dx: -50,
    dy: 40,
    rotate: 0,
    duration: 30,
  },
  {
    id: 3,
    className: 'absolute w-72 h-72 rounded-full bg-primary-300/15 blur-3xl',
    left: '70%',
    top: '60%',
    dx: 30,
    dy: -40,
    rotate: 0,
    duration: 35,
  },
  {
    id: 4,
    className: 'absolute w-48 h-48 rounded-full bg-accent-300/10 blur-3xl',
    left: '5%',
    top: '70%',
    dx: 50,
    dy: 20,
    rotate: 0,
    duration: 28,
  },
  {
    id: 5,
    className: 'absolute w-32 h-32 rounded-2xl bg-primary-400/10 blur-2xl',
    left: '40%',
    top: '5%',
    dx: -20,
    dy: 30,
    rotate: 45,
    duration: 22,
  },
  {
    id: 6,
    className: 'absolute w-40 h-40 rounded-2xl bg-neutral-300/20 blur-2xl',
    left: '25%',
    top: '80%',
    dx: 35,
    dy: -25,
    rotate: -30,
    duration: 32,
  },
];

export function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-neutral-50 to-accent-100" />

      {/* Floating shapes */}
      {shapes.map((shape) => (
        <motion.div
          key={shape.id}
          className={shape.className}
          initial={{
            left: shape.left,
            top: shape.top,
          }}
          animate={{
            x: [0, shape.dx, 0],
            y: [0, shape.dy, 0],
            rotate: [0, shape.rotate, 0],
          }}
          transition={{
            duration: shape.duration,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            left: shape.left,
            top: shape.top,
          }}
        />
      ))}

      {/* Subtle noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

export default AnimatedBackground;
