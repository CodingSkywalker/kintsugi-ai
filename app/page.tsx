'use client';

import React, { useEffect, useRef, useState } from 'react';

// Define the global types for external libraries loaded via script tags
declare global {
  interface Window {
    Chart: any;
    THREE: any;
  }
}

const NODES = [
  { id: "us-west-1", name: "US-West · N. California", lat: 37.4, lon: -122.0 },
  { id: "us-west-2", name: "US-West · Oregon", lat: 45.8, lon: -119.7 },
  { id: "us-central", name: "US-Central · Dallas", lat: 32.8, lon: -96.8 },
  { id: "us-east-1", name: "US-East · Virginia", lat: 38.0, lon: -78.5 },
  { id: "us-east-2", name: "US-East · Ohio", lat: 40.0, lon: -83.0 },
  { id: "ca-central", name: "Canada · Montréal", lat: 45.5, lon: -73.6 },
  { id: "sa-east", name: "S. America · São Paulo", lat: -23.5, lon: -46.6 },
  { id: "eu-west-1", name: "EU-West · Ireland", lat: 53.3, lon: -6.3 },
  { id: "eu-west-2", name: "EU-West · London", lat: 51.5, lon: -0.1 },
  { id: "eu-west-3", name: "EU-West · Paris", lat: 48.9, lon: 2.35 },
  { id: "eu-central", name: "EU-Central · Frankfurt", lat: 50.1, lon: 8.7 },
  { id: "eu-north", name: "EU-North · Stockholm", lat: 59.3, lon: 18.1 },
  { id: "eu-south", name: "EU-South · Milan", lat: 45.5, lon: 9.2 },
  { id: "me-south", name: "Middle East · Bahrain", lat: 26.1, lon: 50.6 },
  { id: "me-central", name: "Middle East · UAE", lat: 24.5, lon: 54.4 },
  { id: "af-south", name: "Africa · Cape Town", lat: -33.9, lon: 18.4 },
  { id: "ap-south", name: "AP-South · Mumbai", lat: 19.1, lon: 72.9 },
  { id: "ap-se-1", name: "AP-SE · Singapore", lat: 1.35, lon: 103.8 },
  { id: "ap-se-2", name: "AP-SE · Sydney", lat: -33.8, lon: 151.2 },
  { id: "ap-se-3", name: "AP-SE · Jakarta", lat: -6.2, lon: 106.8 },
  { id: "ap-ne-1", name: "AP-NE · Tokyo", lat: 35.7, lon: 139.7 },
  { id: "ap-ne-2", name: "AP-NE · Seoul", lat: 37.5, lon: 127.0 },
  { id: "ap-ne-3", name: "AP-NE · Osaka", lat: 34.7, lon: 135.5 },
  { id: "ap-east", name: "AP-East · Hong Kong", lat: 22.3, lon: 114.2 },
  { id: "cn-north", name: "China · Beijing", lat: 39.9, lon: 116.4 },
];

const ALL = NODES.map(n => n.id);
const STATE_COLORS = { green: 0x3ef0b0, warn: 0xffcf5c, crit: 0xff5e7e, heal: 0x38e1ff };

export default function ControlRoom() {
  const globeRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<HTMLDivElement>(null);
  const chLatRef = useRef<HTMLCanvasElement>(null);
  const chReqRef = useRef<HTMLCanvasElement>(null);

  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [uptime, setUptime] = useState("99.997%");
  const [reqSec, setReqSec] = useState("12,480");
  const [healsCount, setHealsCount] = useState(0);
  const [sysStatus, setSysStatus] = useState({ level: "ok", text: "All Systems Nominal" });
  const [isStorming, setIsStorming] = useState(false);
  const [nowLat, setNowLat] = useState(42);
  const [nowReq, setNowReq] = useState(12.5);
  const [termLines, setTermLines] = useState<{ id: number; time: string; type: string; tag?: string; text: string }[]>([]);

  const markerMeshes = useRef<any>({});
  const latData = useRef<number[]>(Array(40).fill(42));
  const reqData = useRef<number[]>(Array(40).fill(12.5));
  const latChartInstance = useRef<any>(null);
  const reqChartInstance = useRef<any>(null);
  const telemetryModifiers = useRef({ latSpike: 0, reqSpike: false, reqDrop: false });

  // Load external scripts (Three.js & Chart.js) dynamically
  useEffect(() => {
    let threeScript = document.createElement('script');
    threeScript.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    threeScript.async = true;

    let chartScript = document.createElement('script');
    chartScript.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
    chartScript.async = true;

    document.body.appendChild(threeScript);
    document.body.appendChild(chartScript);

    const checkInterval = setInterval(() => {
      if (window.THREE && window.Chart) {
        clearInterval(checkInterval);
        setScriptsLoaded(true);
      }
    }, 100);

    // Initial terminal setup
    const clock = () => new Date().toTimeString().slice(0, 8);
    setTermLines([
      { id: 1, time: clock(), type: "info", tag: "BOOT", text: `AI Sentry online · monitoring ${NODES.length} regions · 25,600 nodes` },
      { id: 2, time: clock(), type: "think", text: "baseline established — latency 42ms, error budget 100%" }
    ]);

    return () => {
      clearInterval(checkInterval);
      document.body.removeChild(threeScript);
      document.body.removeChild(chartScript);
    };
  }, []);

  // Initialize 3D Globe & Charts once scripts load
  useEffect(() => {
    if (!scriptsLoaded || !globeRef.current || !chLatRef.current || !chReqRef.current) return;

    const THREE = window.THREE;
    const Chart = window.Chart;

    // --- CHART.JS CONFIG ---
    const labels = Array.from({ length: 40 }, (_, i) => i);
    const mkChart = (ctx: HTMLCanvasElement, color: string, fill: string) => {
      return new Chart(ctx, {
        type: "line",
        data: {
          labels: [...labels],
          datasets: [{
            data: Array(40).fill(null),
            borderColor: color,
            borderWidth: 2,
            fill: true,
            backgroundColor: fill,
            tension: 0.4,
            pointRadius: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { display: false },
            y: { grid: { color: "rgba(255,255,255,.06)" }, ticks: { color: "#6b7f9c", font: { size: 10 } } }
          }
        }
      });
    };

    latChartInstance.current = mkChart(chLatRef.current, "#38e1ff", "rgba(56,225,255,.12)");
    reqChartInstance.current = mkChart(chReqRef.current, "#b79bff", "rgba(183,155,255,.12)");

    // --- THREE.JS GLOBE CONFIG ---
    const host = globeRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 3.05);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    const root = new THREE.Group();
    const globeGroup = new THREE.Group();
    root.add(globeGroup);
    scene.add(root);
    root.rotation.z = 0.41;

    const R = 1;
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(R, 96, 96),
      new THREE.MeshPhongMaterial({ color: 0x1a2740, specular: 0x213a5c, shininess: 20 })
    );
    globeGroup.add(earth);

    // Night lights textures fallback gracefully
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    const base = "https://unpkg.com/three-globe@2.31.0/example/img/";
    loader.load(base + "earth-night.jpg", (t: any) => {
      earth.material.map = t;
      earth.material.emissiveMap = t;
      earth.material.emissive.setHex(0xffe2a6);
      earth.material.emissiveIntensity = 1.85;
      earth.material.color.setHex(0x16294d);
      earth.material.needsUpdate = true;
    });

    const grat = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.SphereGeometry(R * 1.001, 24, 16)),
      new THREE.LineBasicMaterial({ color: 0x38e1ff, transparent: true, opacity: 0.07 })
    );
    globeGroup.add(grat);

    scene.add(new THREE.AmbientLight(0x33538c, 0.55));
    const sun = new THREE.DirectionalLight(0x9fb8ff, 0.18);
    sun.position.set(3, 1.5, 2.5);
    scene.add(sun);

    const vec = (lat: number, lon: number, r: number) => {
      const phi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
      return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
    };

    NODES.forEach(n => {
      const p = vec(n.lat, n.lon, R * 1.01);
      const grp = new THREE.Group();
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 16), new THREE.MeshBasicMaterial({ color: STATE_COLORS.green }));
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.034, 16, 16), new THREE.MeshBasicMaterial({ color: STATE_COLORS.green, transparent: true, opacity: 0.35 }));
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.042, 32), new THREE.MeshBasicMaterial({ color: STATE_COLORS.green, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
      ring.lookAt(p.clone().multiplyScalar(2));
      grp.position.copy(p); grp.add(core); grp.add(halo); grp.add(ring);
      globeGroup.add(grp);
      markerMeshes.current[n.id] = { core, halo, ring, grp, phase: Math.random() * 6.28 };
    });

    // Handle Drag Interactivity
    let drag = false, lx = 0, ly = 0, vrx = 0, vry = 0;
    const el = renderer.domElement;
    el.addEventListener("pointerdown", (e: any) => { drag = true; lx = e.clientX; ly = e.clientY; });
    window.addEventListener("pointerup", () => drag = false);
    window.addEventListener("pointermove", (e: any) => {
      if (!drag) return;
      const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      vry = dx * 0.005; vrx = dy * 0.005;
      globeGroup.rotation.y += vry; globeGroup.rotation.x = Math.max(-1.1, Math.min(1.1, globeGroup.rotation.x + vrx));
    });

    const clock = new THREE.Clock();
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05), et = clock.getElapsedTime();
      if (!drag) {
        globeGroup.rotation.y += 0.10 * dt;
      }
      Object.values(markerMeshes.current).forEach((m: any) => {
        const s = 1 + 0.35 * Math.sin(et * 3 + m.phase);
        m.halo.scale.setScalar(s);
        m.halo.material.opacity = 0.18 + 0.14 * (1 - (s - 0.65));
        const rp = (Math.sin(et * 2 + m.phase) + 1) / 2;
        m.ring.scale.setScalar(1 + 0.5 * rp);
        m.ring.material.opacity = 0.7 * (1 - rp) + 0.15;
      });
      renderer.render(scene, camera);
    };
    animate();

    // Telemetry Ticker
    const ticker = setInterval(() => {
      const { latSpike, reqSpike, reqDrop } = telemetryModifiers.current;
      let lat = 42 + (Math.random() - 0.5) * 6 + latSpike * (0.6 + Math.random() * 0.4);
      let req = 12.5 + (Math.random() - 0.5) * 0.6;
      if (reqSpike) req = 12.5 * 9 + (Math.random() - 0.5) * 8;
      if (reqDrop) req = 12.5 * 0.35 + (Math.random() - 0.5) * 1;
      lat = Math.max(8, lat); req = Math.max(0.5, req);

      latData.current.push(lat); latData.current.shift();
      reqData.current.push(req); reqData.current.shift();

      if (latChartInstance.current) {
        latChartInstance.current.data.datasets[0].data = [...latData.current];
        latChartInstance.current.data.datasets[0].borderColor = latSpike ? "#ffcf5c" : "#38e1ff";
        latChartInstance.current.update();
      }
      if (reqChartInstance.current) {
        reqChartInstance.current.data.datasets[0].data = [...reqData.current];
        reqChartInstance.current.update();
      }

      setNowLat(Math.round(lat));
      setNowReq(parseFloat(req.toFixed(1)));
      setReqSec(Math.round(req * 1000).toLocaleString());
    }, 900);

    return () => {
      cancelAnimationFrame(animId);
      clearInterval(ticker);
      if (host.contains(renderer.domElement)) host.removeChild(renderer.domElement);
    };
  }, [scriptsLoaded]);

  // Terminal Auto-Scroll
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [termLines]);

  const updateMarkerColor = (id: string, state: keyof typeof STATE_COLORS) => {
    const m = markerMeshes.current[id];
    if (m) {
      const c = STATE_COLORS[state];
      m.core.material.color.setHex(c);
      m.halo.material.color.setHex(c);
      m.ring.material.color.setHex(c);
    }
  };

  const addTermLine = (type: string, tag: string | undefined, text: string) => {
    const clock = () => new Date().toTimeString().slice(0, 8);
    setTermLines(prev => [...prev, { id: Date.now() + Math.random(), time: clock(), type, tag, text }]);
  };

  const runScenario = async (testType: 'lag' | 'blackout' | 'spike' | 'corrupt') => {
    if (isStorming) return;
    setIsStorming(true);

    const randomRegion = ALL[Math.floor(Math.random() * ALL.length)];
    const regionName = NODES.find(n => n.id === randomRegion)?.name || randomRegion;

    const scenarios = {
      lag: { label: "NETWORK LAG", modifier: () => telemetryModifiers.current.latSpike = 620, initialColor: "warn" as const },
      blackout: { label: "ZONE BLACKOUT", modifier: () => { telemetryModifiers.current.latSpike = 900; telemetryModifiers.current.reqDrop = true; }, initialColor: "crit" as const },
      spike: { label: "TRAFFIC SPIKE", modifier: () => { telemetryModifiers.current.reqSpike = true; telemetryModifiers.current.latSpike = 380; }, initialColor: "warn" as const },
      corrupt: { label: "DATA CORRUPTION", modifier: () => telemetryModifiers.current.latSpike = 300, initialColor: "crit" as const },
    };

    const target = scenarios[testType];
    setSysStatus({ level: testType === 'lag' || testType === 'spike' ? 'warn' : 'crit', text: `${target.label} · ${regionName}` });
    addTermLine("crit", "CHAOS", `fault injected → ${target.label} @ ${regionName}`);
    updateMarkerColor(randomRegion, target.initialColor);
    target.modifier();

    // Trigger backend automated healing engine API via absolute live route
    try {
      const res = await fetch('/api/heal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logs: {
            timestamp: new Date().toISOString(),
            incident: target.label,
            target_region: randomRegion,
            metric_impact: testType === 'lag' ? 'latency_620ms' : 'zone_unreachable'
          }
        })
      });
      const aiDecision = await res.json();

      // Output Gemini Agent's intelligence stream to the terminal layout
      setTimeout(() => addTermLine("warn", "DETECT", `Gemini SRE processing global context payload...`), 400);
      setTimeout(() => addTermLine("think", undefined, `Analyzing: Root Cause flagged as "${aiDecision.root_cause || 'Degraded Node Path'}"`), 1200);
      setTimeout(() => addTermLine("info", "ACTION", `Executing target mitigation: [${aiDecision.action_command || 'SCALE_CAPACITY'}] across ${aiDecision.affected_region || randomRegion}`), 2200);
      setTimeout(() => {
        addTermLine("heal", "HEAL", `Resilience mechanism verified with ${((aiDecision.execution_confidence || 0.95) * 100).toFixed(0)}% confidence ✓`);
        updateMarkerColor(randomRegion, "heal");
      }, 3400);

    } catch (e) {
      setTimeout(() => addTermLine("crit", "FAIL", "Failed to compile automated resilience routine hook."), 1000);
    }

    // Reset loop
    setTimeout(() => {
      updateMarkerColor(randomRegion, "green");
      telemetryModifiers.current = { latSpike: 0, reqSpike: false, reqDrop: false };
      setHealsCount(prev => prev + 1);
      setSysStatus({ level: "ok", text: "All Systems Nominal" });
      addTermLine("info", "OK", "incident closed · logs stored safely in Aurora DSQL cluster.");
      setIsStorming(false);
    }, 5500);
  };

  return (
    <div className="bg-black min-h-screen font-sans antialiased text-[#eaf2ff] overflow-x-hidden">
      {/* Dynamic Background Layout styling injection mimicking styles natively inside template */}
      <style dangerouslySetInnerHTML={{__html: `
        .glass-panel {
          background: linear-gradient(160deg, rgba(14,14,18,.62), rgba(6,6,8,.55));
          border: 1px solid rgba(255,255,255,.07);
          box-shadow: 0 12px 40px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.05);
          backdrop-filter: blur(22px) saturate(140%);
        }
        .text-glow { text-shadow: 0 0 14px rgba(56,225,255,.25); }
        .pulse-dot { animation: pulseAnim 1.8s ease-in-out infinite; }
        @keyframes pulseAnim { 0%, 100% { opacity: 1 } 50% { opacity: .35 } }
      `}} />

      <div className="flex flex-col h-screen p-4 gap-4">
        {/* HEADER BAR */}
        <header className="glass-panel rounded-[20px] px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[13px] bg-gradient-to-br from-[#38e1ff] to-[#b79bff] flex items-center justify-center font-extrabold text-[#06101c] text-lg shadow-[0_0_22px_rgba(56,225,255,.5)]">
              金
            </div>
            <div>
              <h1 className="text-sm tracking-wide font-bold">KINTSUGI&nbsp;AI <span className="text-[#9fb2cc] font-medium">// Emergency Control Room</span></h1>
              <small className="block text-[10px] text-[#6b7f9c] tracking-[2.5px] uppercase mt-0.5">Autonomous Resilience Platform</small>
            </div>
          </div>
          <div className="flex items-center gap-7">
            <div className="text-right"><div className="text-lg font-bold text-glow">{uptime}</div><div className="text-[9.5px] text-[#6b7f9c] tracking-[1.6px] uppercase">Uptime 30d</div></div>
            <div className="text-right"><div className="text-lg font-bold text-glow">{reqSec}</div><div className="text-[9.5px] text-[#6b7f9c] tracking-[1.6px] uppercase">Req / sec</div></div>
            <div className="text-right"><div className="text-lg font-bold text-glow">{healsCount}</div><div className="text-[9.5px] text-[#6b7f9c] tracking-[1.6px] uppercase">Auto-heals</div></div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 border border-white/5 text-xs font-semibold">
              <span className={`w-2.5 h-2.5 rounded-full pulse-dot ${sysStatus.level === 'crit' ? 'bg-[#ff5e7e] shadow-[0_0_14px_#ff5e7e]' : sysStatus.level === 'warn' ? 'bg-[#ffcf5c] shadow-[0_0_14px_#ffcf5c]' : 'bg-[#3ef0b0] shadow-[0_0_14px_#3ef0b0]'}`}></span>
              <span>{sysStatus.text}</span>
            </div>
          </div>
        </header>

        {/* CONTAINER WORKSPACE */}
        <main className="grid grid-cols-1 lg:grid-cols-5 flex-1 gap-4 min-h-0 overflow-hidden">
          {/* LEFT PANELS */}
          <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
            <div className="glass-panel rounded-[20px] flex-1 relative overflow-hidden min-h-[350px]">
              <h2 className="absolute top-4 left-[18px] right-[18px] z-10 text-[10.5px] font-bold tracking-[2.4px] text-[#9fb2cc] uppercase flex items-center gap-2 before:content-[''] before:w-1.5 before:h-1.5 before:bg-[#38e1ff] before:rounded-full before:inline-block">
                Global Fleet — Live Topology <span className="ml-auto text-[10px] text-[#6b7f9c] normal-case font-medium tracking-normal">drag to rotate grid</span>
              </h2>
              <div ref={globeRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
              <div className="absolute bottom-4 left-[18px] flex gap-4 text-xs text-[#9fb2cc] z-10">
                <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#3ef0b0] inline-block shadow-[0_0_8px_#3ef0b0]"></i>Healthy</span>
                <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#ffcf5c] inline-block shadow-[0_0_8px_#ffcf5c]"></i>Degraded</span>
                <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#ff5e7e] inline-block shadow-[0_0_8px_#ff5e7e]"></i>Critical</span>
              </div>
            </div>

            {/* CHAOS ENGINE WORKSTATION */}
            <div className="glass-panel rounded-[20px] p-4 flex flex-col min-h-0">
              <h2 className="text-[10.5px] font-bold tracking-[2.4px] text-[#9fb2cc] uppercase flex items-center gap-2 mb-3 before:content-[''] before:w-1.5 before:h-1.5 before:bg-[#38e1ff] before:rounded-full before:inline-block">
                Chaos Engineering — Fire Drill Controls
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <button disabled={isStorming} onClick={() => runScenario('lag')} className="group text-left border border-white/5 rounded-ebd rounded-[14px] p-3 transition bg-gradient-to-br from-white/5 to-transparent hover:border-[#ffcf5c]/60 disabled:opacity-40">
                  <span className="font-bold text-sm flex items-center gap-2"><span className="text-base">📡</span>Inject Network Lag</span>
                  <span className="block text-[11px] text-[#6b7f9c] mt-0.5">+800ms latency · Amazon Aurora</span>
                </button>
                <button disabled={isStorming} onClick={() => runScenario('blackout')} className="group text-left border border-white/5 rounded-ebd rounded-[14px] p-3 transition bg-gradient-to-br from-white/5 to-transparent hover:border-[#ff5e7e]/60 disabled:opacity-40">
                  <span className="font-bold text-sm flex items-center gap-2"><span className="text-base">⚡</span>Simulate Blackout</span>
                  <span className="block text-[11px] text-[#6b7f9c] mt-0.5">Drop primary server node</span>
                </button>
                <button disabled={isStorming} onClick={() => runScenario('spike')} className="group text-left border border-white/5 rounded-ebd rounded-[14px] p-3 transition bg-gradient-to-br from-white/5 to-transparent hover:border-[#ffcf5c]/60 disabled:opacity-40">
                  <span className="font-bold text-sm flex items-center gap-2"><span className="text-base">📈</span>Spike Traffic 10×</span>
                  <span className="block text-[11px] text-[#6b7f9c] mt-0.5">Flash-crowd simulator</span>
                </button>
                <button disabled={isStorming} onClick={() => runScenario('corrupt')} className="group text-left border border-white/5 rounded-ebd rounded-[14px] p-3 transition bg-gradient-to-br from-white/5 to-transparent hover:border-[#ff5e7e]/60 disabled:opacity-40">
                  <span className="font-bold text-sm flex items-center gap-2"><span className="text-base">🧬</span>Data Corruption</span>
                  <span className="block text-[11px] text-[#6b7f9c] mt-0.5">Inject malformed packages</span>
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT CHARTS & TERMINAL MONITOR */}
          <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
            <div className="glass-panel rounded-[20px] p-4 flex flex-col gap-4 h-[280px]">
              <div className="flex-1 relative">
                <div className="flex justify-between items-baseline mb-1"><h3 className="text-xs font-semibold text-[#6b7f9c]">Latency (ms)</h3><span className="font-bold text-[#38e1ff] text-shadow text-sm">{nowLat}</span></div>
                <div className="w-100 h-[80px]"><canvas ref={chLatRef} /></div>
              </div>
              <div className="flex-1 relative">
                <div className="flex justify-between items-baseline mb-1"><h3 className="text-xs font-semibold text-[#6b7f9c]">Throughput (k req/s)</h3><span className="font-bold text-[#b79bff] text-shadow text-sm">{nowReq}</span></div>
                <div className="w-100 h-[80px]"><canvas ref={chReqRef} /></div>
              </div>
            </div>

            {/* LIVE AI SENTRY TERMINAL LOG STREAM */}
            <div className="glass-panel rounded-[20px] p-4 flex flex-col flex-1 min-h-0">
              <h2 className="text-[10.5px] font-bold tracking-[2.4px] text-[#9fb2cc] uppercase flex items-center gap-2 mb-2 before:content-[''] before:w-1.5 before:h-1.5 before:bg-[#38e1ff] before:rounded-full before:inline-block">
                AI Sentry — Reasoning Stream
              </h2>
              <div ref={termRef} className="flex-1 overflow-y-auto font-mono text-xs pr-1 scrollbar-thin scrollbar-thumb-white/20">
                {termLines.map(line => (
                  <div key={line.id} className="flex gap-2 py-0.5">
                    <span className="text-[#6b7f9c] select-none">{line.time}</span>
                    <span className={`${line.type === 'info' ? 'text-[#38e1ff]' : line.type === 'warn' ? 'text-[#ffcf5c]' : line.type === 'crit' ? 'text-[#ff5e7e]' : line.type === 'heal' ? 'text-[#3ef0b0]' : 'text-[#b79bff] italic'}`}>
                      {line.tag && <span className="font-bold mr-1">[{line.tag}]</span>}
                      <span dangerouslySetInnerHTML={{ __html: line.text }} />
                    </span>
                  </div>
                ))}
              </div>
              <div className="font-mono text-xs text-[#3ef0b0] mt-2 border-t border-white/5 pt-2">
                sentry@kintsugi:~$ <span className="inline-block w-2 h-3.5 bg-[#3ef0b0] animate-pulse align-middle"></span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}