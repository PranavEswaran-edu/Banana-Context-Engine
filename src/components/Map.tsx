import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to handle map centering when coordinates change
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

interface MapProps {
  lat: number;
  lon: number;
  zoom?: number;
}

export default function Map({ lat, lon, zoom = 15 }: MapProps) {
  const position: [number, number] = [lat, lon];

  return (
    <MapContainer 
      center={position} 
      zoom={zoom} 
      style={{ height: '100%', width: '100%', zIndex: 0 }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <Circle 
        center={position} 
        radius={1000} 
        pathOptions={{ color: '#e4e4e7', fillColor: '#e4e4e7', fillOpacity: 0.1, weight: 1 }} 
      />
      <Marker position={position} />
      <MapUpdater center={position} />
    </MapContainer>
  );
}
