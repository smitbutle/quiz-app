import React, { useState } from 'react';
import {
  Card, CardContent, Typography, Grid, Paper, Box, Divider,
  Dialog, DialogContent, IconButton
} from '@mui/material';
import { green, red, grey, orange } from '@mui/material/colors';
import CloseIcon from '@mui/icons-material/Close';
import {
  PieChart, Pie, Cell, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = [green[500], red[500], grey[500], orange[500]];

// Custom label component for pie chart
const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }) => {
  const RADIAN = Math.PI / 180;
  // Calculate position closer to the center
  const radius = innerRadius + (outerRadius - innerRadius) * 0.3;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  // Only show label if the segment is large enough
  if (percent < 0.05) return null;

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      style={{ 
        fontSize: '12px', 
        fontWeight: 'bold',
        textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
      }}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const ReportCard = ({ report }) => {
  const [selectedImage, setSelectedImage] = useState(null);

  if (!report) return <Typography variant="h6">No report data available.</Typography>;

  const { username, test_id, test_name, details, summary } = report;

  const statusCount = {
    Pass: 0,
    Fail: 0,
    'Not Attempted': 0,
    'Multiple face detected': 0
  };

  const scoreTrend = [];

  details.forEach((attempt, index) => {
    if (attempt.score === -1) {
      statusCount['Multiple face detected'] = (statusCount['Multiple face detected'] || 0) + 1;
    } else {
      statusCount[attempt.status] = (statusCount[attempt.status] || 0) + 1;
    }

    if (attempt.score !== null && attempt.score !== -1) {
      scoreTrend.push({
        name: `#${index + 1}`,
        score: parseFloat((attempt.score * 100).toFixed(2))
      });
    }
  });

  const pieData = [
    { name: 'Pass', value: statusCount['Pass'] },
    { name: 'Fail', value: statusCount['Fail'] },
    { name: 'Face not detected', value: statusCount['Not Attempted'] },
    { name: 'Multiple face detected', value: statusCount['Multiple face detected'] }
  ].filter(item => item.value > 0); // Only show non-zero values

  // Calculate total for percentage calculations
  const totalAttempts = pieData.reduce((sum, item) => sum + item.value, 0);

  // Custom tooltip component for pie chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const percentage = ((payload[0].value / totalAttempts) * 100).toFixed(1);

      return (
        <Box
          sx={{
            backgroundColor: 'white',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            {payload[0].name}
          </Typography>
          <Typography variant="body2">
            Count: {payload[0].value}
          </Typography>
          <Typography variant="body2">
            Percentage: {percentage}%
          </Typography>
        </Box>
      );
    }
    return null;
  };

  const handleAttemptClick = (timestamp) => {
    const imageKey = `face_auth_${timestamp}`;
    const imageData = localStorage.getItem(imageKey);
    if (imageData) {
      setSelectedImage(imageData);
    }
  };

  return (
    <Box sx={{ padding: 2 }}>
      {/* Header Card */}
      <Card 
        sx={{ 
          marginBottom: 2,
          background: 'linear-gradient(45deg,rgb(52, 148, 245) 30%, #2196f3 90%)',
          color: 'white'
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                Face Authentication Report
              </Typography>
              <Box sx={{ display: 'flex', gap: 3 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                    Username
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                    {username}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                    Test Name
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                    {test_name}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                    Test ID
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                    {test_id}
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Box 
              sx={{ 
                bgcolor: 'rgba(255, 255, 255, 0.1)', 
                p: 2, 
                borderRadius: 2,
                backdropFilter: 'blur(10px)'
              }}
            >
              <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                Report Generated
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                {new Date().toLocaleDateString()}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                {new Date().toLocaleTimeString()}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <Grid container spacing={2} sx={{ marginBottom: 2 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ marginBottom: 2, color: 'primary.main' }}>
                Summary Statistics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 2, 
                      bgcolor: 'background.default',
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    <Typography variant="subtitle2" color="text.secondary">
                      Average Score
                    </Typography>
                    <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                      {(summary.average_score * 100).toFixed(2)}%
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 2, 
                      bgcolor: 'background.default',
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    <Typography variant="subtitle2" color="text.secondary">
                      Median Score
                    </Typography>
                    <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                      {(summary.median_score * 100).toFixed(2)}%
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 2, 
                      bgcolor: 'background.default',
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    <Typography variant="subtitle2" color="text.secondary">
                      Total Attempts
                    </Typography>
                    <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                      {summary.total_attempts}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 2, 
                      bgcolor: 'background.default',
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    <Typography variant="subtitle2" color="text.secondary">
                      Success Rate
                    </Typography>
                    <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                      {((statusCount['Pass'] / totalAttempts) * 100).toFixed(1)}%
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Status Distribution
                </Typography>
                <Grid container spacing={1}>
                  {pieData.map((item, index) => (
                    <Grid item xs={12} key={item.name}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box 
                          sx={{ 
                            width: 12, 
                            height: 12, 
                            borderRadius: '50%', 
                            bgcolor: COLORS[index % COLORS.length] 
                          }} 
                        />
                        <Typography variant="body2">
                          {item.name}: {item.value} ({((item.value / totalAttempts) * 100).toFixed(1)}%)
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ marginBottom: 2, color: 'primary.main' }}>
                Authentication Status Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={60}
                    paddingAngle={2}
                    label={CustomLabel}
                    labelLine={false}
                    minAngle={3}
                  >
                    {pieData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]}
                        stroke="white"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    layout="vertical" 
                    verticalAlign="middle" 
                    align="right"
                    wrapperStyle={{
                      paddingLeft: '20px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Line Chart for Score Trend */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ marginBottom: 2 }}>
            Score Trend Over Attempts
          </Typography>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={scoreTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[90, 100]} unit="%" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="score" stroke={green[500]} activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Individual Attempt Details */}
      <Typography variant="h6" sx={{ marginY: 2 }}>
        Authentication Attempts
      </Typography>
      <Grid container spacing={2}>
        {details.map((attempt, index) => (
          <Grid item xs={12} md={6} key={index}>
            <Paper
              elevation={3}
              sx={{
                padding: 2,
                borderLeft: `6px solid ${
                  attempt.score === -1 ? orange[500] :
                  attempt.status === 'Pass' ? green[500] :
                  attempt.status === 'Fail' ? red[500] :
                  grey[500]
                }`,
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)'
                }
              }}
              onClick={() => handleAttemptClick(attempt.timestamp)}
            >
              <Typography variant="subtitle1">Attempt #{index + 1}</Typography>
              <Typography variant="body2" color="text.secondary">
                Timestamp: {new Date(attempt.timestamp).toLocaleString()}
              </Typography>
              <Typography variant="body2">
                Score: {attempt.score === -1 ? 'N/A' : attempt.score ? `${(attempt.score * 100).toFixed(2)}%` : 'N/A'}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 'bold',
                  color:
                    attempt.score === -1 ? orange[700] :
                    attempt.status === 'Pass' ? green[700] :
                    attempt.status === 'Fail' ? red[700] :
                    grey[700]
                }}
              >
                Status: {attempt.score === -1 ? 'Multiple face detected' : 
                        attempt.status === 'Not Attempted' ? 'Face not detected' : 
                        attempt.status}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Image Modal */}
      <Dialog
        open={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent sx={{ position: 'relative', padding: 0 }}>
          <IconButton
            onClick={() => setSelectedImage(null)}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: 'white',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.7)'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Face Authentication"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block'
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default ReportCard;
