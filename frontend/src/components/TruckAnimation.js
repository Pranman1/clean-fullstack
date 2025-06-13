import React, { useEffect, useRef } from 'react';
import './TruckAnimation.css';

const TruckAnimation = ({ route, isLoading }) => {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  useEffect(() => {
    if (!route || isLoading) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const cities = [];
    const edges = [];
    let truckPositions = [];
    
    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    // Extract unique cities and create node positions
    const uniqueCities = new Set();
    route.forEach(leg => {
      uniqueCities.add(`${leg.origin_city}, ${leg.origin_state}`);
      uniqueCities.add(`${leg.destination_city}, ${leg.destination_state}`);
    });
    
    // Calculate city positions in a circular layout
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) * 0.7;
    
    Array.from(uniqueCities).forEach((city, index) => {
      const angle = (index / uniqueCities.size) * Math.PI * 2;
      cities.push({
        name: city,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      });
    });
    
    // Create edges from route
    route.forEach(leg => {
      const fromCity = cities.find(c => c.name === `${leg.origin_city}, ${leg.origin_state}`);
      const toCity = cities.find(c => c.name === `${leg.destination_city}, ${leg.destination_state}`);
      edges.push({
        from: fromCity,
        to: toCity,
        isDeadhead: leg.is_deadhead,
        distance: leg.distance,
        rate: leg.rate_per_mile_est,
        ship_date: leg.ship_date,
        receive_date: leg.receive_date
      });
      
      // Initialize truck for this edge
      truckPositions.push({ progress: 0, edge: edges[edges.length - 1] });
    });
    
    const drawCity = (city) => {
      ctx.beginPath();
      ctx.arc(city.x, city.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#4a90e2';
      ctx.fill();
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw city name
      ctx.font = '14px Arial';
      ctx.fillStyle = '#2c3e50';
      ctx.textAlign = 'center';
      ctx.fillText(city.name, city.x, city.y + 25);
    };
    
    const drawEdge = (edge, progress = 1) => {
      const { from, to, isDeadhead, distance, rate, ship_date, receive_date } = edge;
      
      // Draw the edge line
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = isDeadhead ? '#e74c3c' : '#2ecc71';
      ctx.lineWidth = 2;
      ctx.setLineDash(isDeadhead ? [5, 5] : []);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw edge info
      const midX = from.x + (to.x - from.x) * 0.5;
      const midY = from.y + (to.y - from.y) * 0.5;
      ctx.font = '12px Arial';
      ctx.fillStyle = '#34495e';
      ctx.textAlign = 'center';
      
      // Format the text based on whether it's a deadhead or not
      let distanceText = '';
      let dateText = '';
      
      if (isDeadhead) {
        distanceText = `${Math.round(distance)} mi (Deadhead)`;
        dateText = ship_date ? ship_date : '';
      } else {
        distanceText = `${Math.round(distance)} mi - $${rate ? rate.toFixed(2) : '0.00'}/mi`;
        dateText = ship_date && receive_date ? `${ship_date} → ${receive_date}` : '';
      }
      
      // Draw distance and rate info
      ctx.fillText(distanceText, midX, midY - 15);
      
      // Draw dates if available
      if (dateText) {
        ctx.fillText(dateText, midX, midY + 5);
      }
    };
    
    const drawTruck = (x, y, angle) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      
      // Draw truck body
      ctx.fillStyle = '#3498db';
      ctx.fillRect(-15, -8, 30, 16);
      
      // Draw cab
      ctx.fillStyle = '#2980b9';
      ctx.fillRect(-15, -8, 10, 16);
      
      // Draw wheels
      ctx.fillStyle = '#2c3e50';
      ctx.beginPath();
      ctx.arc(-10, 8, 3, 0, Math.PI * 2);
      ctx.arc(10, 8, 3, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    };
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw all edges first
      edges.forEach(edge => drawEdge(edge));
      
      // Draw all cities
      cities.forEach(city => drawCity(city));
      
      // Update and draw trucks
      truckPositions = truckPositions.map(truck => {
        const { from, to } = truck.edge;
        truck.progress = (truck.progress + 0.005) % 1;
        
        const x = from.x + (to.x - from.x) * truck.progress;
        const y = from.y + (to.y - from.y) * truck.progress;
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        
        drawTruck(x, y, angle);
        return truck;
      });
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [route, isLoading]);

  if (!isLoading && !route) return null;

  return (
    <div className="truck-animation-container">
      {isLoading ? (
        <div className="searching-animation">
          <div className="road">
            <div className="road-line"></div>
          </div>
          <div className="truck">
            <i className="fas fa-truck"></i>
          </div>
          <div className="searching-text">
            Planning your route...
          </div>
        </div>
      ) : (
        <canvas ref={canvasRef} className="route-canvas" />
      )}
    </div>
  );
};

export default TruckAnimation; 