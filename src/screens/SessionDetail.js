import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
  Dimensions,
} from 'react-native';
import { Card, Button, DataTable } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import DatabaseService from '../services/DatabaseService';

const SessionDetail = ({ route, navigation }) => {
  const { sessionId } = route.params;
  const [session, setSession] = useState(null);
  const [features, setFeatures] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const itemsPerPage = 10;

  useEffect(() => {
    loadSessionData();
  }, [sessionId]);

  const loadSessionData = async () => {
    try {
      console.log('📊 Loading session details for:', sessionId);
      
      const sessionData = await DatabaseService.getSession(sessionId);
      const sessionFeatures = await DatabaseService.getSessionFeatures(sessionId);
      const sessionEvents = await DatabaseService.getSessionEvents(sessionId);
      
      setSession(sessionData);
      setFeatures(sessionFeatures);
      setEvents(sessionEvents);
      setLoading(false);
      
      console.log('✅ Loaded session:', sessionData);
      console.log('✅ Features:', sessionFeatures.length);
      console.log('✅ Events:', sessionEvents.length);
      
    } catch (error) {
      console.error('❌ Error loading session:', error);
      Alert.alert('Error', 'Could not load session data');
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const getSeverityColor = (amplitude) => {
    if (amplitude < 0.5) return '#4CAF50';
    if (amplitude < 1.0) return '#8BC34A';
    if (amplitude < 2.0) return '#FFC107';
    if (amplitude < 4.0) return '#FF9800';
    return '#F44336';
  };

  const handleExportCSV = async () => {
    try {
      console.log('📤 Exporting CSV...');
      const csv = await DatabaseService.exportSessionToCSV(sessionId);
      
      // Share the CSV data
      await Share.share({
        message: csv,
        title: `Tremor Session ${sessionId}`,
      });
      
      console.log('✅ CSV exported');
    } catch (error) {
      console.error('❌ Export error:', error);
      Alert.alert('Export Error', error.message);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Session',
      'Are you sure you want to delete this session? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.deleteSession(sessionId);
              Alert.alert('Deleted', 'Session deleted successfully');
              navigation.goBack();
            } catch (error) {
              console.error('❌ Delete error:', error);
              Alert.alert('Error', 'Could not delete session');
            }
          }
        },
      ]
    );
  };

  const prepareChartData = () => {
    if (features.length === 0) {
      return {
        labels: ['No Data'],
        datasets: [{ data: [0] }],
      };
    }

    // Sample data points if too many (max 10 points for readability)
    const maxPoints = 10;
    const step = Math.max(1, Math.floor(features.length / maxPoints));
    
    const sampledFeatures = features.filter((_, index) => index % step === 0);
    
    const labels = sampledFeatures.map((f, index) => {
      const time = new Date(f.timestamp);
      return time.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    });
    
    const frequencyData = sampledFeatures.map(f => f.frequency);
    
    return {
      labels,
      datasets: [
        {
          data: frequencyData,
          color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading session...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Session not found</Text>
        <Button onPress={() => navigation.goBack()}>Go Back</Button>
      </View>
    );
  }

  const startDate = new Date(session.start_time);
  const endDate = session.end_time ? new Date(session.end_time) : null;
  const chartData = prepareChartData();
  
  const from = page * itemsPerPage;
  const to = Math.min((page + 1) * itemsPerPage, features.length);

  return (
    <ScrollView style={styles.container}>
      {/* Header Card */}
      <Card style={styles.headerCard}>
        <Card.Content>
          <Text style={styles.sessionTitle}>
            Session {sessionId}
          </Text>
          <Text style={styles.sessionDate}>
            {startDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
          <Text style={styles.sessionTime}>
            {startDate.toLocaleTimeString()} - {endDate ? endDate.toLocaleTimeString() : 'In Progress'}
          </Text>
        </Card.Content>
      </Card>

      {/* Summary Stats Card */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>Summary Statistics</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{formatDuration(session.total_duration)}</Text>
              <Text style={styles.statLabel}>Total Duration</Text>
            </View>
            
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{session.episode_count}</Text>
              <Text style={styles.statLabel}>Tremor Episodes</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: getSeverityColor(session.peak_amplitude) }]}>
                {session.peak_amplitude.toFixed(2)}
              </Text>
              <Text style={styles.statLabel}>Peak Amplitude (m/s²)</Text>
            </View>
            
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{session.avg_frequency.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Avg Frequency (Hz)</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Frequency Chart */}
      {features.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Frequency Over Time</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <LineChart
                data={chartData}
                width={Math.max(Dimensions.get('window').width - 64, chartData.labels.length * 60)}
                height={220}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: {
                    borderRadius: 16,
                  },
                  propsForDots: {
                    r: '4',
                    strokeWidth: '2',
                    stroke: '#2196F3',
                  },
                }}
                bezier
                style={styles.chart}
                yAxisLabel=""
                yAxisSuffix=" Hz"
              />
            </ScrollView>
            <Text style={styles.chartCaption}>
              Tremor frequency measurements throughout the session
            </Text>
          </Card.Content>
        </Card>
      )}

      {/* Raw Data Table */}
      {features.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Raw Data</Text>
            
            <DataTable>
              <DataTable.Header>
                <DataTable.Title>Time</DataTable.Title>
                <DataTable.Title numeric>Freq (Hz)</DataTable.Title>
                <DataTable.Title numeric>Amp (m/s²)</DataTable.Title>
                <DataTable.Title numeric>Severity</DataTable.Title>
              </DataTable.Header>

              {features.slice(from, to).map((feature) => {
                const time = new Date(feature.timestamp);
                return (
                  <DataTable.Row key={feature.id}>
                    <DataTable.Cell>
                      {time.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </DataTable.Cell>
                    <DataTable.Cell numeric>{feature.frequency.toFixed(1)}</DataTable.Cell>
                    <DataTable.Cell numeric>{feature.amplitude.toFixed(2)}</DataTable.Cell>
                    <DataTable.Cell numeric>{feature.severity}/4</DataTable.Cell>
                  </DataTable.Row>
                );
              })}

              <DataTable.Pagination
                page={page}
                numberOfPages={Math.ceil(features.length / itemsPerPage)}
                onPageChange={setPage}
                label={`${from + 1}-${to} of ${features.length}`}
                showFastPaginationControls
                numberOfItemsPerPage={itemsPerPage}
              />
            </DataTable>
          </Card.Content>
        </Card>
      )}

      {/* Tremor Events */}
      {events.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Tremor Events ({events.length})</Text>
            
            {events.map((event, index) => {
              const startTime = new Date(event.start_time);
              return (
                <View key={event.id} style={styles.eventItem}>
                  <View style={styles.eventHeader}>
                    <Text style={styles.eventNumber}>Event #{index + 1}</Text>
                    <Text style={styles.eventTime}>
                      {startTime.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </Text>
                  </View>
                  <View style={styles.eventDetails}>
                    <Text style={styles.eventDetail}>
                      Duration: {event.duration}s
                    </Text>
                    <Text style={styles.eventDetail}>
                      Peak: {event.peak_amplitude.toFixed(2)} m/s²
                    </Text>
                    <Text style={styles.eventDetail}>
                      Freq: {event.dominant_frequency.toFixed(1)} Hz
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card.Content>
        </Card>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Button 
          mode="contained" 
          onPress={handleExportCSV}
          style={styles.actionButton}
          icon="download"
        >
          Export CSV
        </Button>
        
        <Button 
          mode="outlined" 
          onPress={handleDelete}
          style={styles.actionButton}
          textColor="#F44336"
          icon="delete"
        >
          Delete Session
        </Button>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 16,
  },
  headerCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#1976D2',
  },
  sessionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  sessionDate: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 2,
  },
  sessionTime: {
    fontSize: 14,
    color: '#E3F2FD',
  },
  card: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  chartCaption: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  eventItem: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  eventNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  eventTime: {
    fontSize: 14,
    color: '#666',
  },
  eventDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eventDetail: {
    fontSize: 13,
    color: '#666',
  },
  actions: {
    margin: 16,
    marginTop: 8,
  },
  actionButton: {
    marginBottom: 12,
  },
  bottomSpacer: {
    height: 32,
  },
});

export default SessionDetail;
