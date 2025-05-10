import React from 'react';
import {
  Card, CardContent, Typography, Grid, Paper, Box, Divider
} from '@mui/material';
import { green, red, grey } from '@mui/material/colors';
import {
  PieChart, Pie, Cell, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = [green[500], red[500], grey[500]];

const ReportCard = ({ report }) => {
  if (!report) return <Typography variant="h6">No report data available.</Typography>;

  const { username, test_id, test_name, details, summary } = report;

  const statusCount = {
    Pass: 0,
    Fail: 0,
    'Not Attempted': 0
  };

  const scoreTrend = [];

  details.forEach((attempt, index) => {
    statusCount[attempt.status] = (statusCount[attempt.status] || 0) + 1;

    if (attempt.score !== null) {
      scoreTrend.push({
        name: `#${index + 1}`,
        score: parseFloat((attempt.score * 100).toFixed(2))
      });
    }
  });

  const pieData = [
    { name: 'Pass', value: statusCount['Pass'] },
    { name: 'Fail', value: statusCount['Fail'] }, // Include Fail if you expect it in other data
    { name: 'Face not detected', value: statusCount['Not Attempted'] },
  ];

  return (
    <Box sx={{ padding: 2 }}>
      {/* Header Card */}
      <Card sx={{ marginBottom: 2 }}>
        <CardContent>
          <Typography variant="h5">Face Authentication Report</Typography>
          <Typography color="text.secondary">Username: {username}</Typography>
          <Typography color="text.secondary">Test: {test_name} (ID: {test_id})</Typography>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <Grid container spacing={2} sx={{ marginBottom: 2 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6">Summary</Typography>
              <Typography>Average Score: {(summary.average_score * 100).toFixed(2)}%</Typography>
              <Typography>Median Score: {(summary.median_score * 100).toFixed(2)}%</Typography>
              <Typography>Total Attempts: {summary.total_attempts}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                outerRadius={60}
                label
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Grid>
      </Grid>

      {/* Line Chart for Score Trend */}
      <Card sx={{ marginBottom: 3 }}>
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
                  attempt.status === 'Pass' ? green[500] :
                  attempt.status === 'Fail' ? red[500] :
                  grey[500]
                }`
              }}
            >
              <Typography variant="subtitle1">Attempt #{index + 1}</Typography>
              <Typography variant="body2" color="text.secondary">
                Timestamp: {new Date(attempt.timestamp).toLocaleString()}
              </Typography>
              <Typography variant="body2">
                Score: {attempt.score ? `${(attempt.score * 100).toFixed(2)}%` : 'N/A'}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 'bold',
                  color:
                    attempt.status === 'Pass' ? green[700] :
                    attempt.status === 'Fail' ? red[700] :
                    grey[700]
                }}
              >
                Status: {attempt.status === 'Not Attempted' ? 'Face detection failed' : attempt.status}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default ReportCard;
