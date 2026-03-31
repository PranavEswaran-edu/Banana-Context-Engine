/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Search, MapPin, Layers, CloudRain, Cpu, Loader2, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { GoogleGenAI } from '@google/genai';
import jsPDF from 'jspdf';
import domtoimage from 'dom-to-image-more';
import Map from './components/Map';

const BananaIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 13c3.5-2 8-2 10 2a9.5 9.5 0 0 1 8 3 6.5 6.5 0 0 0-12-11.5 10 10 0 0 0-5.5 6.5Z" />
  </svg>
);

export default function App() {
  const [searchQuery, setSearchQuery] = useState('MANIT Bhopal');
  const [isSearching, setIsSearching] = useState(false);
  const [location, setLocation] = useState({
    name: 'Maulana Azad National Institute of Technology',
    lat: 23.2146,
    lon: 77.4060,
  });

  // Data States
  const [urbanData, setUrbanData] = useState<{ buildings: number; roads: number; amenities: number } | null>(null);
  const [climateData, setClimateData] = useState<{ temp: number; humidity: number; solar: number; wind: number } | null>(null);
  const [aiReport, setAiReport] = useState<string | null>(null);

  // Loading States
  const [isFetchingUrban, setIsFetchingUrban] = useState(false);
  const [isFetchingClimate, setIsFetchingClimate] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPDF(true);
    try {
      const element = reportRef.current;
      const originalHeight = element.style.height;
      const originalOverflow = element.style.overflow;
      
      // Temporarily expand the element to capture full content
      element.style.height = 'auto';
      element.style.overflow = 'visible';
      
      const scale = 2;
      const imgData = await domtoimage.toPng(element, {
        bgcolor: '#0a0a0a',
        width: element.offsetWidth * scale,
        height: element.offsetHeight * scale,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: element.offsetWidth + 'px',
          height: element.offsetHeight + 'px'
        }
      });
      
      // Restore original styles
      element.style.height = originalHeight;
      element.style.overflow = originalOverflow;
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [element.offsetWidth * scale, element.offsetHeight * scale]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, element.offsetWidth * scale, element.offsetHeight * scale);
      pdf.save('Banana_Context_Engine_Report.pdf');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        setLocation({
          name: data[0].display_name,
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
        });
        // Reset data on new search
        setUrbanData(null);
        setClimateData(null);
        setAiReport(null);
      } else {
        alert('Location not found. Please try a different search term.');
      }
    } catch (error) {
      console.error('Error fetching location:', error);
      alert('Error fetching location data.');
    } finally {
      setIsSearching(false);
    }
  };

  const fetchUrbanData = async () => {
    setIsFetchingUrban(true);
    try {
      const radius = 1000;
      const query = `
        [out:json];
        (
          way["building"](around:${radius},${location.lat},${location.lon});
          way["highway"](around:${radius},${location.lat},${location.lon});
          node["amenity"](around:${radius},${location.lat},${location.lon});
        );
        out tags;
      `;
      
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`
      });
      
      const data = await response.json();
      
      let buildings = 0;
      let roads = 0;
      let amenities = 0;

      data.elements.forEach((el: any) => {
        if (el.tags?.building) buildings++;
        if (el.tags?.highway) roads++;
        if (el.tags?.amenity) amenities++;
      });

      setUrbanData({ buildings, roads, amenities });
    } catch (error) {
      console.error('Error fetching urban data:', error);
      alert('Failed to fetch urban data from Overpass API.');
    } finally {
      setIsFetchingUrban(false);
    }
  };

  const fetchClimateData = async () => {
    setIsFetchingClimate(true);
    try {
      // NASA POWER Climatology API (Long-term averages)
      const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,RH2M,ALLSKY_SFC_SW_DWN,WS10M&community=RE&longitude=${location.lon}&latitude=${location.lat}&format=JSON`;
      const response = await fetch(url);
      const data = await response.json();
      
      const params = data.properties.parameter;
      
      setClimateData({
        temp: params.T2M.ANN, // Annual Average Temperature at 2 Meters
        humidity: params.RH2M.ANN, // Annual Average Relative Humidity at 2 Meters
        solar: params.ALLSKY_SFC_SW_DWN.ANN, // Annual Average Solar Radiation
        wind: params.WS10M.ANN // Annual Average Wind Speed at 10 Meters
      });
    } catch (error) {
      console.error('Error fetching climate data:', error);
      alert('Failed to fetch climate data from NASA POWER API.');
    } finally {
      setIsFetchingClimate(false);
    }
  };

  const generateAIReport = async () => {
    if (!urbanData || !climateData) {
      alert('Please fetch both Urban Morphology and Microclimate data first.');
      return;
    }

    setIsGeneratingAI(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `
        You are a Senior Architect and Urban Planner. I need a concise, professional site analysis report based on the following extracted data.
        
        Site Location: ${location.name}
        Coordinates: Latitude ${location.lat.toFixed(4)}, Longitude ${location.lon.toFixed(4)}
        
        Urban Morphology (1km radius):
        - Building Footprints: ${urbanData.buildings}
        - Road Networks: ${urbanData.roads}
        - Local Amenities: ${urbanData.amenities}
        
        Microclimate (Annual Averages from NASA POWER):
        - Temperature: ${climateData.temp}°C
        - Relative Humidity: ${climateData.humidity}%
        - Solar Radiation: ${climateData.solar} kWh/m²/day
        - Wind Speed: ${climateData.wind} m/s
        
        Please generate a report with the following sections:
        1. **Site Context Summary**: Brief overview of the density and climate zone.
        2. **Recommended Building Orientation**: Based on the solar radiation and temperature.
        3. **Passive Cooling/Heating Strategies**: Based on wind speed, temperature, and humidity.
        4. **Zoning & Connectivity Suggestions**: Based on the urban density (buildings vs roads vs amenities).
        
        Keep the tone professional, architectural, and concise. Use bullet points where appropriate.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
      });

      setAiReport(response.text || 'Failed to generate report.');
    } catch (error) {
      console.error('Error generating AI report:', error);
      alert('Failed to generate AI report. Please check your API key configuration.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-300 font-sans selection:bg-zinc-800">
      {/* Header */}
      <header className="border-b border-zinc-800/60 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-yellow-400 rounded flex items-center justify-center">
              <BananaIcon className="w-5 h-5 text-[#0a0a0a]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-mono text-sm font-semibold text-yellow-400 tracking-tight uppercase">
                  Banana Context Engine
                </h1>
                <span className="text-[9px] font-mono bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded border border-green-500/30">v25.0.1</span>
              </div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
                Site Analysis Automation
              </p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="relative w-full max-w-md hidden sm:block">
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter site location (e.g., MANIT Bhopal)"
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-md py-1.5 pl-9 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-all"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 w-4 h-4 text-zinc-500 animate-spin" />
              )}
            </div>
          </form>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mobile Search */}
        <form onSubmit={handleSearch} className="mb-6 sm:hidden">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search location..."
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-md py-2 pl-9 pr-4 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600"
            />
          </div>
        </form>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)] min-h-[600px]">
          {/* Left Panel: Map */}
          <div className="lg:col-span-2 rounded-xl border border-zinc-800/60 overflow-hidden bg-zinc-900/20 relative group">
            <div className="absolute top-4 left-4 z-10 bg-[#0a0a0a]/80 backdrop-blur-md border border-zinc-800/60 rounded-md p-3 shadow-2xl max-w-sm">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-xs font-mono text-zinc-100 uppercase tracking-wider mb-1">
                    Active Site
                  </h3>
                  <p className="text-sm text-zinc-400 leading-snug line-clamp-2">
                    {location.name}
                  </p>
                  <div className="mt-2 flex gap-3 text-[10px] font-mono text-zinc-500">
                    <span>LAT: {location.lat.toFixed(4)}°</span>
                    <span>LON: {location.lon.toFixed(4)}°</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="w-full h-full bg-zinc-900">
              <Map lat={location.lat} lon={location.lon} />
            </div>
          </div>

          {/* Right Panel: Data Modules */}
          <div className="flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
            
            {/* Module 1: Urban Data */}
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/20 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-zinc-400" />
                  <h2 className="text-xs font-mono text-zinc-100 uppercase tracking-wider">
                    Urban Morphology
                  </h2>
                </div>
                {urbanData && <span className="text-[10px] text-green-400 font-mono bg-green-400/10 px-2 py-0.5 rounded">SYNCED</span>}
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded bg-zinc-900/50 border border-zinc-800/40 flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Building Footprints</span>
                  <span className="text-xs font-mono text-zinc-300">{urbanData ? urbanData.buildings : '--'}</span>
                </div>
                <div className="p-3 rounded bg-zinc-900/50 border border-zinc-800/40 flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Road Networks</span>
                  <span className="text-xs font-mono text-zinc-300">{urbanData ? urbanData.roads : '--'}</span>
                </div>
                <div className="p-3 rounded bg-zinc-900/50 border border-zinc-800/40 flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Local Amenities</span>
                  <span className="text-xs font-mono text-zinc-300">{urbanData ? urbanData.amenities : '--'}</span>
                </div>
                <button 
                  onClick={fetchUrbanData}
                  disabled={isFetchingUrban}
                  className="w-full mt-2 py-2 rounded bg-zinc-800/50 hover:bg-zinc-800 text-xs font-mono text-zinc-300 transition-colors border border-zinc-700/50 disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isFetchingUrban ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  {isFetchingUrban ? 'FETCHING...' : 'FETCH OVERPASS DATA'}
                </button>
              </div>
            </div>

            {/* Module 2: Climate Data */}
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/20 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CloudRain className="w-4 h-4 text-zinc-400" />
                  <h2 className="text-xs font-mono text-zinc-100 uppercase tracking-wider">
                    Microclimate (5 YR)
                  </h2>
                </div>
                {climateData && <span className="text-[10px] text-green-400 font-mono bg-green-400/10 px-2 py-0.5 rounded">SYNCED</span>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded bg-zinc-900/50 border border-zinc-800/40">
                  <div className="text-[10px] text-zinc-500 uppercase mb-1">Avg Temp</div>
                  <div className="text-lg font-mono text-zinc-300">{climateData ? climateData.temp.toFixed(1) : '--'}°C</div>
                </div>
                <div className="p-3 rounded bg-zinc-900/50 border border-zinc-800/40">
                  <div className="text-[10px] text-zinc-500 uppercase mb-1">Humidity</div>
                  <div className="text-lg font-mono text-zinc-300">{climateData ? climateData.humidity.toFixed(1) : '--'}%</div>
                </div>
                <div className="p-3 rounded bg-zinc-900/50 border border-zinc-800/40">
                  <div className="text-[10px] text-zinc-500 uppercase mb-1">Solar Rad.</div>
                  <div className="text-lg font-mono text-zinc-300">{climateData ? climateData.solar.toFixed(2) : '--'}</div>
                </div>
                <div className="p-3 rounded bg-zinc-900/50 border border-zinc-800/40">
                  <div className="text-[10px] text-zinc-500 uppercase mb-1">Wind Spd.</div>
                  <div className="text-lg font-mono text-zinc-300">{climateData ? climateData.wind.toFixed(1) : '--'}</div>
                </div>
              </div>
              <button 
                onClick={fetchClimateData}
                disabled={isFetchingClimate}
                className="w-full mt-4 py-2 rounded bg-zinc-800/50 hover:bg-zinc-800 text-xs font-mono text-zinc-300 transition-colors border border-zinc-700/50 disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isFetchingClimate ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                {isFetchingClimate ? 'FETCHING...' : 'FETCH NASA POWER DATA'}
              </button>
            </div>

            {/* Module 3: AI Insight */}
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/20 p-5 flex-1 flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-zinc-400" />
                  <h2 className="text-xs font-mono text-zinc-100 uppercase tracking-wider">
                    AI Architect Analysis
                  </h2>
                </div>
                {aiReport && <span className="text-[10px] text-green-400 font-mono bg-green-400/10 px-2 py-0.5 rounded">GENERATED</span>}
              </div>
              
              <div className="flex-1 rounded bg-zinc-900/50 border border-zinc-800/40 p-4 flex flex-col relative overflow-hidden">
                {aiReport ? (
                  <div className="flex flex-col h-full">
                    <div className="overflow-y-auto custom-scrollbar flex-1 pr-2">
                      <div ref={reportRef} className="text-sm text-zinc-300 prose prose-invert prose-p:leading-relaxed prose-headings:font-mono prose-headings:text-yellow-400 prose-a:text-blue-400 bg-[#0a0a0a] p-4 rounded-md border border-zinc-800/50">
                        <ReactMarkdown>{aiReport}</ReactMarkdown>
                      </div>
                    </div>
                    <button 
                      onClick={downloadPDF}
                      disabled={isGeneratingPDF}
                      className="mt-4 w-full py-2 rounded bg-green-500 text-[#0a0a0a] hover:bg-green-400 text-xs font-mono font-semibold transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                      {isGeneratingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      {isGeneratingPDF ? 'GENERATING PDF...' : 'DOWNLOAD AS PDF'}
                    </button>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <p className="text-sm text-zinc-500 mb-4">
                      {urbanData && climateData 
                        ? "Data synced. Ready to generate architectural insights."
                        : "Awaiting site data extraction to generate architectural insights."}
                    </p>
                    <button 
                      onClick={generateAIReport}
                      disabled={!urbanData || !climateData || isGeneratingAI}
                      className="px-4 py-2 rounded bg-yellow-400 text-[#0a0a0a] hover:bg-yellow-300 text-xs font-mono font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isGeneratingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      {isGeneratingAI ? 'GENERATING...' : 'GENERATE REPORT'}
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
