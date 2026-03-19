import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, Dimensions } from 'react-native';
import { Card, Button, DataTable } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const screenWidth = Dimensions.get('window').width;

const SessionDetail = ({ route, navigation }) => {
  // Get sessionId from navigation params
  const { sessionId } = route.params || { sessionId: 1 };

  // Mock session data - will come from SQLite later
  const sessionData = {
    id: sessionId,
    date: 'Feb 19, 2026',
    time: '10:30 AM',
    duration: 300,
    episodeCount: 1,
    totalTremorTime: 45,
    avgFrequency: 4.8,
    maxSeverity: 2,
  };

  // Mock frequency over time data
  const frequencyData = {
    labels: ['0:00', '1:00', '2:00', '3:00', '4:00', '5:00'],
    datasets: [{
      data: [3.2, 4.5, 5.1, 4.8, 3.5, 3.0],
      color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
    }]
  };

  // Mock raw data table
  const rawDataSamples = [
    { timestamp: '10:30:15', frequency: 4.2, amplitude: 125000, severity: 1 },
    { timestamp: '10:30:16', frequency: 4.5, amplitude: 145000, severity: 2 },
    { timestamp: '10:30:17', frequency: 4.8, amplitude: 198000, severity: 2 },
    { timestamp: '10:30:18', frequency: 5.1, amplitude: 215000, severity: 2 },
    { timestamp: '10:30:19', frequency: 4.9, amplitude: 189000, severity: 2 },
    { timestamp: '10:30:20', frequency: 4.3, amplitude: 152000, severity: 2 },
    { timestamp: '10:30:21', frequency: 3.8, amplitude: 98000, severity: 1 },
    { timestamp: '10:30:22', frequency: 3.2, amplitude: 45000, severity: 0 },
  ];

  const getSeverityLabel = (severity) => {
    const labels = ['None', 'Mild', 'Moderate', 'Severe', 'Critical'];
    return labels[severity] || 'None';
  };

  const getSeverityColor = (severity) => {
    const colors = ['#10B981', '#F59E0B', '#F97316', '#EF4444', '#DC2626'];
    return colors[severity] || '#10B981';
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const handleExport = () => {
    // Will implement CSV export later
    console.log('Export session data');
  };

  const handleDelete = () => {
    // Will implement session deletion later
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Icon 
          name="arrow-left" 
          size={24} 
          color="#1E293B" 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        />
        <View>
          <Text style={styles.title}>{sessionData.date}</Text>
          <Text style={styles.subtitle}>{sessionData.time}</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Session Summary */}
        <Text style={styles.sectionTitle}>Session Summary</Text>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Duration</Text>
                <Text style={styles.summaryValue}>{formatDuration(sessionData.duration)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Episodes</Text>
                <Text style={styles.summaryValue}>{sessionData.episodeCount}</Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Tremor Time</Text>
                <Text style={styles.summaryValue}>{sessionData.totalTremorTime}s</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Avg Frequency</Text>
                <Text style={styles.summaryValue}>{sessionData.avgFrequency} Hz</Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Max Severity</Text>
                <Text style={[styles.summaryValue, { color: getSeverityColor(sessionData.maxSeverity) }]}>
                  {getSeverityLabel(sessionData.maxSeverity)}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Frequency Over Time Graph */}
        <Text style={styles.sectionTitle}>Frequency Over Time</Text>
        <Card style={styles.chartCard}>
          <Card.Content>
            <LineChart
              data={frequencyData}
              width={screenWidth - 64}
              height={220}
              chartConfig={{
                backgroundColor: '#FFFFFF',
                backgroundGradientFrom: '#FFFFFF',
                backgroundGradientTo: '#FFFFFF',
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                style: { borderRadius: 16 },
                propsForDots: {
                  r: '4',
                  strokeWidth: '2',
                  stroke: '#2563EB'
                }
              }}
              bezier
              style={styles.chart}
              yAxisLabel=""
              yAxisSuffix=" Hz"
            />
          </Card.Content>
        </Card>

        {/* Raw Data Table */}
        <Text style={styles.sectionTitle}>Raw Data</Text>
        <Card style={styles.tableCard}>
          <Card.Content>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title>Time</DataTable.Title>
                <DataTable.Title numeric>Freq (Hz)</DataTable.Title>
                <DataTable.Title numeric>Amplitude</DataTable.Title>
                <DataTable.Title>Severity</DataTable.Title>
              </DataTable.Header>

              {rawDataSamples.map((row, index) => (
                <DataTable.Row key={index}>
                  <DataTable.Cell>{row.timestamp}</DataTable.Cell>
                  <DataTable.Cell numeric>{row.frequency.toFixed(1)}</DataTable.Cell>
                  <DataTable.Cell numeric>{row.amplitude.toLocaleString()}</DataTable.Cell>
                  <DataTable.Cell>
                    <Text style={[styles.severityText, { color: getSeverityColor(row.severity) }]}>
                      {getSeverityLabel(row.severity)}
                    </Text>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>
          </Card.Content>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Button
            mode="contained"
            icon="file-export"
            onPress={handleExport}
            style={styles.exportButton}
          >
            Export CSV
          </Button>
          <Button
            mode="outlined"
            icon="delete"
            onPress={handleDelete}
            style={styles.deleteButton}
            textColor="#EF4444"
          >
            Delete
          </Button>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 16,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
    color: '#1E293B',
  },
  summaryCard: {
    marginBottom: 24,
    borderRadius: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  chartCard: {
    marginBottom: 24,
    borderRadius: 12,
  },
  chart: {
    borderRadius: 16,
  },
  tableCard: {
    marginBottom: 24,
    borderRadius: 12,
  },
  severityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  exportButton: {
    flex: 1,
    borderRadius: 8,
  },
  deleteButton: {
    flex: 1,
    borderRadius: 8,
    borderColor: '#EF4444',
  },
});

export default SessionDetail;
