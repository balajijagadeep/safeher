const { getDatabase } = require('../db/database');

/**
 * Calculates distance in kilometers between two lat/lng coordinates (Haversine Formula)
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Compute transparent, explainable 0-100 AI Safety Score for a given coordinate & timestamp
 * @param {number} lat Latitude
 * @param {number} lng Longitude
 * @param {Date} date Optional timestamp (defaults to now)
 */
async function computeAreaSafetyScore(lat, lng, date = new Date()) {
    const db = getDatabase();
    const factors = [];
    let score = 100;

    const hour = date.getHours();

    // 1. Time of Day Penalty
    let timePenalty = 0;
    let timeDesc = 'Normal daytime hours';

    if (hour >= 1 && hour < 5) {
        timePenalty = 25;
        timeDesc = `Critical late night (${hour}:00 hrs) - Very low public visibility`;
    } else if (hour >= 22 || hour === 0) {
        timePenalty = 18;
        timeDesc = `Late night (${hour}:00 hrs) - Reduced commercial activity`;
    } else if (hour >= 19 && hour < 22) {
        timePenalty = 8;
        timeDesc = `Post-dusk evening (${hour}:00 hrs) - Moderate lighting`;
    } else if (hour >= 5 && hour < 6) {
        timePenalty = 10;
        timeDesc = `Early dawn (${hour}:00 hrs) - Sparse traffic`;
    }

    if (timePenalty > 0) {
        score -= timePenalty;
        factors.push({
            factor: 'Time of Day',
            impact: -timePenalty,
            description: timeDesc
        });
    } else {
        factors.push({
            factor: 'Time of Day',
            impact: 0,
            description: 'Active daylight period with high footfall'
        });
    }

    // 2. Emergency Services Proximity
    const emergencyServices = db.prepare(`SELECT * FROM emergency_services`).all();
    let minPoliceDist = Infinity;
    let nearestPolice = null;
    let minHospitalDist = Infinity;
    let nearestHospital = null;
    let open24x7Count = 0;

    emergencyServices.forEach(srv => {
        const dist = calculateDistanceKm(lat, lng, srv.lat, srv.lng);
        if (srv.type === 'police' && dist < minPoliceDist) {
            minPoliceDist = dist;
            nearestPolice = srv;
        } else if (srv.type === 'hospital' && dist < minHospitalDist) {
            minHospitalDist = dist;
            nearestHospital = srv;
        }

        if (srv.is_24x7 && dist <= 2.0) {
            open24x7Count++;
        }
    });

    // Police distance factor
    if (minPoliceDist > 5.0) {
        score -= 18;
        factors.push({
            factor: 'Police Distance',
            impact: -18,
            description: `Nearest police station is ${minPoliceDist.toFixed(1)} km away (>5 km response threshold)`
        });
    } else if (minPoliceDist > 2.5) {
        score -= 8;
        factors.push({
            factor: 'Police Distance',
            impact: -8,
            description: `Police station is ${minPoliceDist.toFixed(1)} km away (${nearestPolice ? nearestPolice.name : 'Station'})`
        });
    } else {
        factors.push({
            factor: 'Police Distance',
            impact: +5,
            description: `Rapid police response zone: ${nearestPolice ? nearestPolice.name : 'Station'} within ${minPoliceDist.toFixed(1)} km`
        });
        score = Math.min(100, score + 5);
    }

    // Hospital distance factor
    if (minHospitalDist > 4.0) {
        score -= 10;
        factors.push({
            factor: 'Medical Emergency Proximity',
            impact: -10,
            description: `Emergency medical facility is ${minHospitalDist.toFixed(1)} km away`
        });
    } else {
        factors.push({
            factor: 'Medical Emergency Proximity',
            impact: 0,
            description: `Hospital nearby: ${nearestHospital ? nearestHospital.name : 'Hospital'} (${minHospitalDist.toFixed(1)} km)`
        });
    }

    // 3. Community Reported Incidents
    const allIncidents = db.prepare(`SELECT * FROM incident_reports`).all();
    let incidentPenalty = 0;
    const nearbyIncidents = [];

    allIncidents.forEach(inc => {
        const dist = calculateDistanceKm(lat, lng, inc.lat, inc.lng);
        if (dist <= 1.5) { // Within 1.5 km
            nearbyIncidents.push({ ...inc, distanceKm: dist.toFixed(2) });
            if (inc.category === 'harassment' || inc.category === 'stalking') {
                incidentPenalty += 12;
            } else if (inc.category === 'poor_lighting') {
                incidentPenalty += 8;
            } else {
                incidentPenalty += 6;
            }
        }
    });

    incidentPenalty = Math.min(incidentPenalty, 35); // Cap penalty

    if (incidentPenalty > 0) {
        score -= incidentPenalty;
        factors.push({
            factor: 'Community Safety Reports',
            impact: -incidentPenalty,
            description: `${nearbyIncidents.length} verified safety concern(s) reported in this 1.5 km vicinity`
        });
    } else {
        factors.push({
            factor: 'Community Safety Reports',
            impact: 0,
            description: 'No harassment or lighting hazards reported nearby'
        });
    }

    // 4. Commercial & 24x7 Activity Bonus
    if (open24x7Count > 0) {
        const bonus = Math.min(8, open24x7Count * 4);
        score = Math.min(100, score + bonus);
        factors.push({
            factor: '24x7 Public Activity',
            impact: +bonus,
            description: `${open24x7Count} active 24/7 service hubs (pharmacies/hospitals) nearby providing natural surveillance`
        });
    }

    // Clamp score between 5 and 100
    const finalScore = Math.max(5, Math.min(100, Math.round(score)));

    let riskLevel = 'LOW';
    let color = '#10b981'; // green
    if (finalScore < 50) {
        riskLevel = 'HIGH';
        color = '#ef4444'; // red
    } else if (finalScore < 75) {
        riskLevel = 'MODERATE';
        color = '#f59e0b'; // amber
    }

    return {
        score: finalScore,
        riskLevel,
        color,
        evaluatedAt: date.toISOString(),
        location: { lat, lng },
        factors,
        nearbyIncidents,
        nearestServices: {
            police: nearestPolice ? { name: nearestPolice.name, distanceKm: minPoliceDist.toFixed(2) } : null,
            hospital: nearestHospital ? { name: nearestHospital.name, distanceKm: minHospitalDist.toFixed(2) } : null
        },
        modelInfo: {
            modelName: 'SafeHer Heuristic AI Safety Engine v1.0',
            pluggableMLReady: true
        }
    };
}

module.exports = {
    calculateDistanceKm,
    computeAreaSafetyScore
};
