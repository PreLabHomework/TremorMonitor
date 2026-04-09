import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Card, Searchbar, Chip } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import DatabaseService from '../services/DatabaseService';

const History = () => {
  const navigation = useNavigation();
  const [sessions, setSessions] = useState([]);
  const [filteredSessions, setFilteredSessions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load sessions when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadSessions();
    }, [])
  );

  const loadSessions = async () => {
    try {
      console.log('📋 Loading sessions...');
      const allSessions = await DatabaseService.getAllSessions();
      console.log('✅ Loaded sessions:', allSessions.length);
      
      setSessions(allSessions);
      setFilteredSessions(allSessions);
      setLoading(false);
    } catch (error) {
      console.error('❌ Error loading sessions:', error);
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    
    if (query.trim() === '') {
      setFilteredSessions(sessions);
    } else {
      const filtered = sessions.filter(session => {
        const date = new Date(session.start_time).toLocaleDateString().toLowerCase();
        const time = new Date(session.start_time).toLocaleTimeString().toLowerCase();
        const notes = (session.notes || '').toLowerCase();
        const searchLower = query.toLowerCase();
        
        return date.includes(searchLower) || 
               time.includes(searchLower) || 
               notes.includes(searchLower);
      });
      setFilteredSessions(filtered);
    }
  };

  const getSeverityColor = (peakAmplitude) => {
    if (peakAmplitude < 0.5) return '#4CAF50'; // Green - mild
    if (peakAmplitude < 1.0) return '#8BC34A'; // Light green
    if (peakAmplitude < 2.0) return '#FFC107'; // Yellow - moderate
    if (peakAmplitude < 4.0) return '#FF9800'; // Orange
    return '#F44336'; // Red - severe
  };

  const getSeverityLabel = (peakAmplitude) => {
    if (peakAmplitude < 0.5) return 'Mild';
    if (peakAmplitude < 1.0) return 'Light';
    if (peakAmplitude < 2.0) return 'Moderate';
    if (peakAmplitude < 4.0) return 'Strong';
    return 'Severe';
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getWeekLabel = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now - date;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return 'This Week';
    if (diffDays < 14) return 'Last Week';
    if (diffDays < 30) return 'This Month';
    
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const groupSessionsByWeek = () => {
    const grouped = {};
    
    filteredSessions.forEach(session => {
      const weekLabel = getWeekLabel(session.start_time);
      if (!grouped[weekLabel]) {
        grouped[weekLabel] = [];
      }
      grouped[weekLabel].push(session);
    });
    
    return Object.keys(grouped).map(weekLabel => ({
      week: weekLabel,
      sessions: grouped[weekLabel],
    }));
  };

  const renderSessionCard = ({ item }) => {
    const startDate = new Date(item.start_time);
    const severityColor = getSeverityColor(item.peak_amplitude);
    const severityLabel = getSeverityLabel(item.peak_amplitude);
    
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('SessionDetail', { sessionId: item.id })}
        activeOpacity={0.7}
      >
        <Card style={styles.sessionCard}>
          <Card.Content>
            <View style={styles.sessionHeader}>
              <View style={styles.dateTimeContainer}>
                <Text style={styles.sessionDate}>
                  {startDate.toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </Text>
                <Text style={styles.sessionTime}>
                  {startDate.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </Text>
              </View>
              
              <Chip 
                style={[styles.severityChip, { backgroundColor: severityColor }]}
                textStyle={styles.severityText}
              >
                {severityLabel}
              </Chip>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatDuration(item.total_duration)}</Text>
                <Text style={styles.statLabel}>Duration</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{item.episode_count}</Text>
                <Text style={styles.statLabel}>Episodes</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{item.peak_amplitude.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Peak (m/s²)</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{item.avg_frequency.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Avg Hz</Text>
              </View>
            </View>

            {item.notes && (
              <Text style={styles.notes} numberOfLines={2}>
                {item.notes}
              </Text>
            )}
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderWeekSection = ({ item }) => (
    <View style={styles.weekSection}>
      <Text style={styles.weekHeader}>{item.week}</Text>
      {item.sessions.map(session => (
        <View key={session.id}>
          {renderSessionCard({ item: session })}
        </View>
      ))}
    </View>
  );

  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📊</Text>
      <Text style={styles.emptyTitle}>No Sessions Yet</Text>
      <Text style={styles.emptyText}>
        Start recording tremor data from the Live Monitor to see your sessions here.
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading sessions...</Text>
      </View>
    );
  }

  const groupedData = groupSessionsByWeek();

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <Searchbar
        placeholder="Search sessions..."
        onChangeText={handleSearch}
        value={searchQuery}
        style={styles.searchBar}
      />

      {/* Sessions Count */}
      {sessions.length > 0 && (
        <View style={styles.countContainer}>
          <Text style={styles.countText}>
            {filteredSessions.length} {filteredSessions.length === 1 ? 'session' : 'sessions'}
            {searchQuery && ` (filtered from ${sessions.length})`}
          </Text>
        </View>
      )}

      {/* Sessions List */}
      <FlatList
        data={groupedData}
        renderItem={renderWeekSection}
        keyExtractor={(item, index) => `week-${index}`}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1976D2']}
          />
        }
        ListEmptyComponent={EmptyState}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchBar: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  countContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  countText: {
    fontSize: 14,
    color: '#666',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  weekSection: {
    marginBottom: 24,
  },
  weekHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    marginTop: 8,
  },
  sessionCard: {
    marginBottom: 12,
    elevation: 2,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateTimeContainer: {
    flex: 1,
  },
  sessionDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  sessionTime: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  severityChip: {
    height: 28,
  },
  severityText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  notes: {
    marginTop: 12,
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 32,
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
});

export default History;
