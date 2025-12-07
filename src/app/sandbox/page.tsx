"use client";
import '~/app/globals.css';

export default function Landing() {
  return (
    
    <div className="frame-container frame-main">
        <img src="/cx-title.png" />

        <div>
            User list:

        </div>

        <button className="btn-cx btn-cx-primary">
            <span className="btn-cx__label">Primary</span>
            <span className="btn-cx__icon">check_circle</span>
        </button>

        <button className="btn-cx btn-cx-secondary">
            <span className="btn-cx__label">Secondary</span>
            <span className="btn-cx__icon">check_circle</span>
        </button>

        <button className="btn-cx btn-cx-disabled">
            <span className="btn-cx__label">Disabled</span>
            <span className="btn-cx__icon">cancel</span>
        </button>

        <button className="btn-cx btn-cx-break">
            <span className="btn-cx__label">Break</span>
            <span className="btn-cx__icon">triangle_circle</span>
        </button>

        <button className="btn-cx btn-cx-pause">
            <span className="btn-cx__label">Pause</span>
            <span className="btn-cx__icon">pending</span>
        </button>

        <button className="btn-cx btn-cx-harsh">
            <span className="btn-cx__label">Harsh</span>
            <span className="btn-cx__icon">check_circle</span>
        </button>

        <button className="btn-cx btn-cx-primary btn-cx-full">
            <span className="btn-cx__label">Primary</span>
            <span className="btn-cx__icon">check_circle</span>
        </button>

    </div>

  );
}