import React from 'react';
import { Card, CardContent, Typography, Grid, Paper, Box, Divider } from '@mui/material';
import { green, red } from '@mui/material/colors';

// Sample ReportCard component to display the report data
const ReportCard = ({ report }) => {
  if (!report) return <Typography variant="h6">No report data available.</Typography>;

  const { username, test_id, details, summary } = report;
  let passCount = 0
  let failCount = 0
  let notAttempted = 0
  details.forEach((attempt) => {
    if (attempt.status === 'Pass') {
      passCount++
    } else if (attempt.status === 'Fail') {
      failCount++
    }
    else {
      notAttempted++
    }
  })
  return (
    <Box sx={{ padding: 2 }}>
      {/* User and Test Info Card */}
      <Card sx={{ marginBottom: 2 }}>
        <CardContent>
          <Typography variant="h5" component="div">
            Face Authentication Report
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Username: {username}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Test ID: {test_id}
          </Typography>
        </CardContent>
      </Card>

      {/* Details of Each Attempt */}
      <Typography variant="h6" component="div" sx={{ marginTop: 2, marginBottom: 1 }}>
        Authentication Attempts
      </Typography>
      <Grid container spacing={2}>
        {details.map((attempt, index) => (
          !attempt.score ? <Grid item xs={12} md={6} key={index}>
          <Paper
            elevation={3}
            sx={{
              padding: 2,
              borderLeft: `6px solid ${red[500]}`
            }}
          >
            <Typography variant="subtitle1">Attempt #{index + 1}</Typography>
            <Typography variant="body2" color="text.secondary">
              Timestamp: {new Date(attempt.timestamp).toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Score: N/A
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: red[600], fontWeight: 'bold' }}
            >
              Status: {"Face detected failed"}
            </Typography>
          </Paper>
        </Grid> :
          <Grid item xs={12} md={6} key={index}>
            <Paper
              elevation={3}
              sx={{
                padding: 2,
                borderLeft: attempt.status === 'Pass' ? `6px solid ${green[500]}` : `6px solid ${red[500]}`
              }}
            >
              <Typography variant="subtitle1">Attempt #{index + 1}</Typography>
              <Typography variant="body2" color="text.secondary">
                Timestamp: {new Date(attempt.timestamp).toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Score: {attempt.score.toFixed(3)}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: attempt.status === 'Pass' ? green[600] : red[600], fontWeight: 'bold' }}
              >
                Status: {attempt.status}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Summary Card */}
      <Card sx={{ marginTop: 2 }}>
        <CardContent>
          <Typography variant="h6" component="div">
            Summary
          </Typography>
          <Divider sx={{ marginY: 1 }} />
          <Typography variant="body2">
            Average Score: {summary.average_score.toFixed(3)}
          </Typography>
          <Typography variant="body2">
            Median Score: {summary.median_score.toFixed(3)}
          </Typography>
          <Typography variant="body2">
            Total Attempts: {summary.total_attempts}
          </Typography>
          {/* also display passed and failed ratio with total attempt */}
          <Typography variant="body2"> 
            Authentication score: {(passCount * 100 / (passCount + failCount + notAttempted)).toFixed(2)} %
          </Typography>


        </CardContent>
      </Card>
    </Box>
  );
};

export default ReportCard;
