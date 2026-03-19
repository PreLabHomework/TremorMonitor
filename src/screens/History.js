import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity } from 'react-native';
import { Card, Searchbar, Chip } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const History = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Mock data - will be replaced with SQLite data later
  const sessions = [
    {
      id: 1,
      date: 'Feb 19, 2026',
      time: '10:30 AM',
      duration: 300, // seconds
      episodeCount: 1,
      avgFrequency: 4.8,
      maxSeverity: 2, // 0-4 scale
    },
    {
      id: 2,
      date: 'Feb 18, 2026',
      time: '3:45 PM',
      duration: 600,
      episodeCount: 3,
      avgFrequency: 5.1,
      maxSeverity: 3,
    },
    {
      id: 3,
      date: 'Feb 17, 2026',
      time: '9:15 AM',
      duration: 450,
      episodeCount: 0,
      avgFrequency: null,
      maxSeverity: 0,
    },
    {
      id: 4,
      date: 'Feb 15, 2026',
      time: '2:00 PM',
      duration: 420,
      episodeCount: 2,
      avgFrequency: 4.5,
      maxSeverity: 2,
    },
  ];

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getSeverityLabel = (severity) => {
    const labels = ['None', 'Mild', 'Moderate', 'Severe', 'Critical'];
    return labels[severity] || 'None';
  };

  const getSeverityColor = (severity) => {
    const colors = ['#10B981', '#F59E0B', '#F97316', '#EF4444', '#DC2626'];
    return colors[severity] || '#10B981';
  };

  const groupSessionsByWeek = (sessions) => {
    // Simple grouping - just "This Week" and "Last Week" for now
    const thisWeek = sessions.slice(0, 2);
    const lastWeek = sessions.slice(2);
    
    return [
      { title: 'This Week', data: thisWeek },
      { title: 'Last Week', data: lastWeek },
    ];
  };

  const groupedSessions = groupSessionsByWeek(sessions);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 Session History</Text>
      </View>

      <Searchbar
        placeholder="Search sessions..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />

      <ScrollView style={styles.scrollView}>
        {groupedSessions.map((group, groupIndex) => (
          <View key={groupIndex}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            {group.data.map((session) => (
              <TouchableOpacity
                key={session.id}
                onPress={() => navigation.navigate('SessionDetail', { sessionId: session.id })}
              >
                <Card style={styles.sessionCard}>
                  <Card.Content>
                    <View style={styles.cardHeader}>
                      <View>
                        <Text style={styles.sessionDate}>{session.date}</Text>
                        <Text style={styles.sessionTime}>{session.time}</Text>
                      </View>
                      <Chip
                        style={[styles.severityChip, { backgroundColor: getSeverityColor(session.maxSeverity) }]}
                        textStyle={styles.severityChipText}
                      >
                        {getSeverityLabel(session.maxSeverity)}
                      </Chip>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.statsRow}>
                      <View style={styles.stat}>
                        <Icon name="clock-outline" size={16} color="#64748B" />
                        <Text style={styles.statLabel}>Duration</Text>
                        <Text style={styles.statValue}>{formatDuration(session.duration)}</Text>
                      </View>

                      <View style={styles.stat}>
                        <Icon name="pulse" size={16} color="#64748B" />
                        <Text style={styles.statLabel}>Episodes</Text>
                        <Text style={styles.statValue}>{session.episodeCount}</Text>
                      </View>

                      <View style={styles.stat}>
                        <Icon name="sine-wave" size={16} color="#64748B" />
                        <Text style={styles.statLabel}>Avg Freq</Text>
                        <Text style={styles.statValue}>
                          {session.avgFrequency ? `${session.avgFrequency.toFixed(1)} Hz` : '--'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.viewDetailRow}>
                      <Text style={styles.viewDetailText}>View Details</Text>
                      <Icon name="chevron-right" size={20} color="#2563EB" />
                    </View>
                  </Card.Content>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        ))}
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
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
    color: '#1E293B',
  },
  sessionCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sessionDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  sessionTime: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  severityChip: {
    height: 28,
  },
  severityChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 2,
  },
  viewDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  viewDetailText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '500',
    marginRight: 4,
  },
});

export default History;
